import React from 'react';
import { VerificationPopupProps } from '../types/blockly';
import './VerificationPopup.css';

const formatElapsedTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}분 ${remainingSeconds}초`;
};

const formatVerificationResult = (code?: string) => {
  switch (code) {
    case 'SUCCESS':
      return '성공';
    case 'FAILURE':
      return '실패';
    case 'ERROR':
      return '오류';
    default:
      return '알 수 없음';
  }
};

export const VerificationPopup: React.FC<VerificationPopupProps> = ({ isOpen, onClose, status, result }) => {
  if (!isOpen) return null;

  return (
    <div className="popup-overlay">
      <div className="verification-popup">
        <div className="popup-header">
          <h2>코드 검증 결과</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="popup-content">
          {status === 'loading' && (
            <div className="loading">
              <div className="spinner"></div>
              <p>코드를 검증하는 중입니다...</p>
            </div>
          )}
          {status === 'success' && result && (
            <div className="result">
              {result.verificationResult && (
                <div className="verification-info">
                  <div className="info-item">
                    <span className="label">상태:</span>
                    <span className={`value status-${result.verificationResult.result_code?.toLowerCase()}`}>
                      {formatVerificationResult(result.verificationResult.result_code)}
                    </span>
                  </div>
                  {result.verificationResult.elapsed_time && (
                    <div className="info-item">
                      <span className="label">소요 시간:</span>
                      <span className="value">{formatElapsedTime(result.verificationResult.elapsed_time)}</span>
                    </div>
                  )}
                  {result.verificationResult.message && (
                    <div className="info-item">
                      <span className="label">메시지:</span>
                      <span className="value">{result.verificationResult.message}</span>
                    </div>
                  )}
                </div>
              )}
              {result.error && (
                <div className="error">
                  <h3>오류 발생</h3>
                  <pre>{result.error}</pre>
                </div>
              )}
            </div>
          )}
          {status === 'error' && (
            <div className="error">
              <h3>검증 중 오류가 발생했습니다</h3>
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