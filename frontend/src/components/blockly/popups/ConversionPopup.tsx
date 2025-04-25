import React, { useState } from 'react';
import { formatElapsedTime } from '../utils/time';
import './ConversionPopup.css';

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
}) => {
  const [memo, setMemo] = useState('');
  
  if (!isOpen) return null;

  const getStatusClass = () => {
    if (error) return 'error';
    if (status.includes('완료')) return 'success';
    if (isConverting) return 'running';
    return '';
  };

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <div className="popup-header">
          <h3>코드 변환</h3>
          <button className="popup-close" onClick={onClose}>&times;</button>
        </div>
        <div className="popup-body">
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
          
          {convertedCode && (
            <div className="result-container">
              <div className="converted-code-container">
                <h4>변환된 코드</h4>
                <textarea
                  className="converted-code-textarea"
                  value={convertedCode}
                  readOnly
                  rows={10}
                />
              </div>
              <div className="memo-container">
                <h4>메모</h4>
                <textarea
                  className="memo-textarea"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="변환된 코드에 대한 메모를 입력하세요..."
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>
        <div className="popup-footer">
          <button className="popup-button primary" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConversionPopup; 