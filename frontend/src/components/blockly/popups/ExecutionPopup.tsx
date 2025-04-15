import React from 'react';
import { ExecutionPopupProps } from '../types/blockly.types';
import '../styles/Popup.css';

export const ExecutionPopup: React.FC<ExecutionPopupProps> = ({
  isOpen,
  onClose,
  status,
  result
}) => {
  if (!isOpen) return null;

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <div className="popup-header">
          <h3>코드 실행</h3>
          {status !== '실행 중...' && (
            <button className="popup-close" onClick={onClose}>&times;</button>
          )}
        </div>
        <div className="popup-body">
          <div className="execution-status">
            {status === '실행 중...' && <div className="status-spinner" />}
            <span>{status}</span>
          </div>
          {result && (
            <div className={`popup-result ${result.error ? 'error' : 'success'}`}>
              <pre>{result.output || result.error}</pre>
            </div>
          )}
        </div>
        <div className="popup-footer">
          {status !== '실행 중...' && (
            <button className="popup-button primary" onClick={onClose}>
              확인
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
