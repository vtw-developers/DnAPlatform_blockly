import React from 'react';
import { ExecutionPopupProps } from '../types/blockly';
import './ExecutionPopup.css';

export const ExecutionPopup: React.FC<ExecutionPopupProps> = ({ isOpen, onClose, status, result }) => {
  if (!isOpen) return null;

  return (
    <div className="popup-overlay">
      <div className="execution-popup">
        <div className="popup-header">
          <h2>코드 실행 결과</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="popup-content">
          {status === 'loading' && (
            <div className="loading">
              <div className="spinner"></div>
              <p>코드를 실행하는 중입니다...</p>
            </div>
          )}
          {status === 'success' && result && (
            <div className="result">
              {result.output && (
                <div className="output">
                  <h3>출력</h3>
                  <pre>{result.output}</pre>
                </div>
              )}
              {result.error && (
                <div className="error">
                  <h3>에러</h3>
                  <pre>{result.error}</pre>
                </div>
              )}
            </div>
          )}
          {status === 'error' && (
            <div className="error">
              <h3>실행 중 오류가 발생했습니다</h3>
              <p>{result?.error || '알 수 없는 오류가 발생했습니다.'}</p>
            </div>
          )}
        </div>
        <div className="popup-footer">
          <button className="close-button" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}; 