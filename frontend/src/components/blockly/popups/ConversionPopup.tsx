import React, { useState, useEffect } from 'react';
import { formatElapsedTime } from '../utils/time';
import { codeBlockApi } from '../../../services/api';
import './ConversionPopup.css';

interface ConvertedCodeBlock {
  id: number;
  title: string;
  description: string;
  converted_code: string;
  created_at: string;
  user?: {
    name: string;
    email: string;
  };
  source_code_title: string;
}

interface ConversionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  status: string;
  dagRunId?: string;
  error?: string;
  isConverting: boolean;
  elapsedTime: number;
  onConvert: () => void;
  convertedCode: string;
  currentUser: any;
  sourceCodeTitle: string;
  sourceCodeId: number;
}

export const ConversionPopup: React.FC<ConversionPopupProps> = ({
  isOpen,
  onClose,
  status,
  dagRunId,
  error,
  isConverting,
  elapsedTime,
  onConvert,
  convertedCode,  
  sourceCodeTitle,
  sourceCodeId,
}) => {
  const [memo, setMemo] = useState('');
  const [convertedBlocks, setConvertedBlocks] = useState<ConvertedCodeBlock[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<ConvertedCodeBlock | null>(null);
  
  useEffect(() => {
    if (isOpen) {
      loadConvertedBlocks();
    }
  }, [isOpen]);

  const loadConvertedBlocks = async () => {
    try {
      const response = await codeBlockApi.getConvertedCodes(sourceCodeId);
      setConvertedBlocks(response.blocks);
    } catch (error) {
      console.error('변환된 코드 목록 로딩 실패:', error);
    }
  };

  const handleBlockClick = (block: ConvertedCodeBlock) => {
    setSelectedBlock(block);
    setMemo(block.description);
  };

  const handleSave = async () => {
    if (!selectedBlock) {
      alert('수정할 코드를 선택해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      await codeBlockApi.updateConvertedCode(
        selectedBlock.id,
        memo,
        selectedBlock.converted_code
      );
      
      await loadConvertedBlocks();
      setSelectedBlock(null);
      setMemo('');
      alert('변환된 코드가 수정되었습니다.');
    } catch (error) {
      console.error('코드 수정 실패:', error);
      alert('코드 수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusClass = () => {
    if (error) return 'error';
    if (status.includes('완료')) return 'success';
    if (isConverting) return 'running';
    return '';
  };

  if (!isOpen) return null;

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <div className="popup-header">
          <h3>코드 변환</h3>
          <button className="popup-close" onClick={onClose}>&times;</button>
        </div>
        <div className="popup-body">
          <div className="converted-blocks-container">
            <h4>저장된 변환 코드 목록</h4>
            <div className="converted-blocks-list">
              {convertedBlocks.map((block) => (
                <div 
                  key={block.id} 
                  className={`converted-block-item ${selectedBlock?.id === block.id ? 'selected' : ''}`}
                  onClick={() => handleBlockClick(block)}
                >
                  <div className="block-header">
                    <span className="block-title">{block.source_code_title}</span>
                    <span className="block-date">
                      {new Date(block.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="block-description">{block.description}</div>
                </div>
              ))}
              {convertedBlocks.length === 0 && (
                <div className="no-blocks">저장된 변환 코드가 없습니다.</div>
              )}
            </div>
          </div>
          <button 
            className="convert-button primary" 
            onClick={onConvert}
            disabled={isConverting}
          >
            {isConverting ? '변환 중...' : '변환 시작'}
          </button>
          
          <div className="console-container">
            <div className="console-header">
              <span className="console-title">변환 과정</span>
              {isConverting && (
                <span className="elapsed-time">
                  소요시간: {formatElapsedTime(elapsedTime)}
                </span>
              )}
            </div>
            <div className="console-output">
              <div className={`console-line ${getStatusClass()}`}>
                {status && (
                  <>
                    <span className="console-timestamp">[{new Date().toLocaleTimeString()}]</span>
                    <span className="console-message">{status}</span>
                  </>
                )}
              </div>
              {dagRunId && (
                <div className="console-line">
                  <span className="console-timestamp">[{new Date().toLocaleTimeString()}]</span>
                  <span className="console-message">DAG Run ID: {dagRunId}</span>
                </div>
              )}
              {error && (
                <div className="console-line error">
                  <span className="console-timestamp">[{new Date().toLocaleTimeString()}]</span>
                  <span className="console-message">오류: {error}</span>
                </div>
              )}
            </div>
          </div>
          
          {selectedBlock && (
            <div className="result-container">
              <div className="save-form">                                
                <h4>변환된 코드</h4>
                <pre className="converted-code-textarea">
                  {selectedBlock.converted_code}
                </pre>
                <div className="source-title">원본 코드: {selectedBlock.source_code_title}</div>
                <textarea
                  className="memo-textarea"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="메모를 입력하세요..."
                  rows={3}
                />
                <button 
                  className="convert-save-button"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          )}          
        </div>
      </div>
    </div>
  );
};

export default ConversionPopup; 