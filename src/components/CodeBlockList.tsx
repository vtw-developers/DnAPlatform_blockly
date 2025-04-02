import React, { useState, useEffect } from 'react';
import { CodeBlock } from '../types/CodeBlock';
import { codeBlockApi } from '../services/api';
import './CodeBlockList.css';

interface CodeBlockListProps {
  onSelectBlock: (block: CodeBlock) => void;
  shouldRefresh?: boolean;
  onRefreshComplete?: () => void;
  onDeleteComplete: () => void;
}

interface CodeBlocksResponse {
  blocks: CodeBlock[];
  total: number;
}

export const CodeBlockList: React.FC<CodeBlockListProps> = ({
  onSelectBlock,
  shouldRefresh = false,
  onRefreshComplete,
  onDeleteComplete
}) => {
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocksPerPage = 5;

  const fetchCodeBlocks = async (page: number) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await codeBlockApi.getCodeBlocks(page, blocksPerPage) as CodeBlocksResponse;
      setCodeBlocks(response.blocks);
      setTotalPages(Math.ceil(response.total / blocksPerPage));
      onRefreshComplete?.();
    } catch (error) {
      console.error('코드 블록 목록 조회 중 오류:', error);
      setError('코드 블록 목록을 불러오는데 실패했습니다.');
      setCodeBlocks([]);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCodeBlocks(currentPage);
  }, [currentPage]);

  useEffect(() => {
    if (shouldRefresh) {
      fetchCodeBlocks(currentPage);
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
        fetchCodeBlocks(currentPage);
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
      <div className="code-block-list-header">
        <h3>저장된 코드 목록</h3>
        {selectedBlocks.length > 0 && (
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
        <div className="empty-message">저장된 코드가 없습니다.</div>
      ) : (
        <>
          <div className="code-block-items">
            {codeBlocks.map(block => (
              <div 
                key={block.id} 
                className={`code-block-item ${selectedBlocks.includes(block.id) ? 'selected' : ''}`}
              >
                <div className="code-block-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedBlocks.includes(block.id)}
                    onChange={() => handleBlockCheckboxChange(block.id)}
                  />
                </div>
                <div 
                  className="code-block-content"
                  onClick={() => handleBlockSelect(block)}
                >
                  <h4>{block.title}</h4>
                  <p>{block.description}</p>
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