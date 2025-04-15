import React from 'react';
import { ConversionPopupProps } from '../types/blockly.types';
import { formatElapsedTime } from '../utils/time';
import '../styles/Popup.css';

export const ConversionPopup: React.FC<ConversionPopupProps> = ({
  isOpen,
  onClose,
  status,
  dagRunId,
  error,
  isConverting,
  elapsedTime
}) => {
  if (!isOpen) return null;

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <div className="popup-header">
          <h3>코드 변환</h3>
          {(!isConverting || status === '변환 완료' || status.includes('실패') || status.includes('오류') || status.includes('없음')) && (
            <button className="popup-close" onClick={onClose}>&times;</button>
          )}
        </div>
        <div className="popup-body">
          <div className="execution-status">
            {(status === '변환 요청 중...' || status === '변환 진행 중...' || status === '변환 성공, 결과 가져오는 중...') && <div className="status-spinner" />}
            <span>{status}</span>
            {(isConverting || status === '변환 진행 중...' || status === '변환 성공, 결과 가져오는 중...') && (
              <span className="elapsed-time">
                (소요시간: {formatElapsedTime(elapsedTime)})
              </span>
            )}
          </div>
          {dagRunId && <p>DAG Run ID: {dagRunId}</p>}
          {error && <pre>오류: {error}</pre>}
        </div>
        <div className="popup-footer">
          {(!isConverting || status === '변환 완료' || status.includes('실패') || status.includes('오류') || status.includes('없음')) && (
            <button className="popup-button primary" onClick={onClose}>
              확인
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 