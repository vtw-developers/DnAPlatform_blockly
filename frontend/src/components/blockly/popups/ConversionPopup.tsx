import React from 'react';
import { ConversionPopupProps } from '../types/blockly.types';
import { formatElapsedTime } from '../utils/time';
import './ConversionPopup.css';

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
  if (!isOpen) return null;

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <div className="popup-header">
          <h3>코드 변환</h3>
          <button className="popup-close" onClick={onClose}>&times;</button>
        </div>
        <div className="popup-body">
          {!convertedCode && (
            <button 
              className="convert-button primary" 
              onClick={onConvert}
              disabled={isConverting}
            >
              {isConverting ? '변환 중...' : '변환 시작'}
            </button>
          )}
          
          <div className="execution-status">
            {(status === '변환 요청 중...' || status === '변환 진행 중...' || status === '변환 성공, 결과 가져오는 중...') && <div className="status-spinner" />}
            <span>{status}</span>
            {(isConverting || status === '변환 진행 중...' || status === '변환 성공, 결과 가져오는 중...') && (
              <span className="elapsed-time">
                (소요시간: {formatElapsedTime(elapsedTime)})
              </span>
            )}
          </div>
          
          {convertedCode && (
            <div className="converted-code-container">
              <textarea
                className="converted-code-textarea"
                value={convertedCode}
                readOnly
                rows={10}
              />
            </div>
          )}
          
          {dagRunId && <p>DAG Run ID: {dagRunId}</p>}
          {error && <pre>오류: {error}</pre>}
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