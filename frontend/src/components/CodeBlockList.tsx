import React, { useState, useEffect } from 'react';
import { CodeBlock } from '../types/CodeBlock';
import { codeBlockApi } from '../services/api';
import './CodeBlockList.css';

interface CodeBlockListProps {
  onSelectBlock: (block: CodeBlock) => void;
  shouldRefresh?: boolean;
  onRefreshComplete?: () => void;
  onDeleteComplete: () => void;
  currentUser?: {
    id: number;
    email: string;
    name: string;
  };
}

interface CodeBlocksResponse {
  blocks: CodeBlock[];
  total: number;
}

type TabType = 'my' | 'shared';

export const CodeBlockList: React.FC<CodeBlockListProps> = ({
  onSelectBlock,
  shouldRefresh = false,
  onRefreshComplete,
  onDeleteComplete,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('my');
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocksPerPage = 5;

  const fetchCodeBlocks = async () => {
    setIsLoading(true);
    try {
      console.log('Fetching code blocks with params:', { 
        page: currentPage, 
        limit: blocksPerPage, 
        filterType: activeTab,
        activeTab
      });
      
      const response = await codeBlockApi.getCodeBlocks(currentPage, blocksPerPage, activeTab as 'my' | 'shared');
      console.log('Fetched code blocks:', response);
      
      setCodeBlocks(response.blocks);
      setTotalPages(Math.ceil(response.total / blocksPerPage));
      onRefreshComplete?.();
    } catch (error) {
      console.error('코드 블록을 가져오는데 실패했습니다:', error);
      setError('코드 블록을 가져오는데 실패했습니다.');
      setCodeBlocks([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCodeBlocks();
  }, [currentPage, blocksPerPage, activeTab, currentUser?.id]);

  useEffect(() => {
    if (shouldRefresh) {
      fetchCodeBlocks();
    }
  }, [shouldRefresh]);

  const handleBlockSelect = (block: CodeBlock) => {
    if (!block.blockly_xml) {
      alert('이 코드 블록에는 Blockly XML 데이터가 없습니다.');
      return;
    }
    onSelectBlock(block);
  };

  const handleBlockCheckboxChange = (blockId: number) => {
    setSelectedBlocks(prev => {
      if (prev.includes(blockId)) {
        return prev.filter(id => id !== blockId);
      }
      return [...prev, blockId];
    });
  };

  const handleDeleteSelected = async () => {
    if (!selectedBlocks.length) return;
    
    if (window.confirm('선택한 코드 블록을 삭제하시겠습니까?')) {
      try {
        await codeBlockApi.deleteCodeBlocks(selectedBlocks);
        setSelectedBlocks([]);
        fetchCodeBlocks();
        onDeleteComplete();
      } catch (error) {
        console.error('코드 블록 삭제 중 오류:', error);
        alert('일부 코드 블록 삭제에 실패했습니다.');
      }
    }
  };

  if (error) {
    return <div className="code-block-list error">{error}</div>;
  }

  return (
    <div className="code-block-list">
      <div className="code-block-tabs">
        <button
          className={`tab-button ${activeTab === 'my' ? 'active' : ''}`}
          onClick={() => setActiveTab('my')}
        >
          내 코드
        </button>
        <button
          className={`tab-button ${activeTab === 'shared' ? 'active' : ''}`}
          onClick={() => setActiveTab('shared')}
        >
          공유된 코드
        </button>
      </div>

      <div className="code-block-list-header">       
        {selectedBlocks.length > 0 && activeTab === 'my' && (
          <button 
            className="delete-button"
            onClick={handleDeleteSelected}
          >
            선택 삭제 ({selectedBlocks.length})
          </button>
        )}
      </div>
      
      {isLoading ? (
        <div className="loading">로딩 중...</div>
      ) : codeBlocks.length === 0 ? (
        <div className="empty-message">
          {activeTab === 'my' ? '저장된 코드가 없습니다.' : '공유된 코드가 없습니다.'}
        </div>
      ) : (
        <>
          <div className="code-block-items">
            {codeBlocks.map(block => (
              <div 
                key={block.id} 
                className={`code-block-item ${selectedBlocks.includes(block.id) ? 'selected' : ''}`}
              >
                {activeTab === 'my' && (
                  <div className="code-block-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedBlocks.includes(block.id)}
                      onChange={() => handleBlockCheckboxChange(block.id)}
                    />
                  </div>
                )}
                <div 
                  className="code-block-content"
                  onClick={() => handleBlockSelect(block)}
                >
                  <h4>{block.title}</h4>
                  <p>{block.description}</p>
                  {block.user && (
                    <small className="author-info">작성자: {block.user.name}</small>
                  )}
                  {!block.blockly_xml && (
                    <small className="warning">Blockly XML 없음</small>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {totalPages > 1 && (
            <div className="pagination">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                이전
              </button>
              <span>{currentPage} / {totalPages}</span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}; 