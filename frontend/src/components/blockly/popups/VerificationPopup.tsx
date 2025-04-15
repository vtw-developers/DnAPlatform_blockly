import React, { useState } from 'react';
import './VerificationPopup.css';

interface VerificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  status: string;
  result: string;
  error?: string;
  elapsedTime: number;
  dagRunId?: string;
  code?: string;
  isVerifying: boolean;
  onExecute?: (code: string) => void;
  executionResult?: string;
  isExecuting?: boolean;
}

export const VerificationPopup: React.FC<VerificationPopupProps> = ({
  isOpen,
  onClose,
  status,
  result,
  error,
  elapsedTime,
  dagRunId,
  code,
  isVerifying,
  onExecute,
  executionResult,
  isExecuting
}) => {
  if (!isOpen) return null;

  return (
    <div className="verification-popup-overlay">
      <div className="verification-popup">
        <div className="verification-popup-header">
          <h2>코드 검증</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="verification-popup-content">
          {code && (
            <div className="verification-code-section">
              <h3>검증할 코드</h3>
              <pre className="code-display">{code}</pre>
            </div>
          )}

          <div className="verification-status-section">
            <div className="status-row">
              <span className="status-label">상태:</span>
              <span className={`status-value ${status.toLowerCase()}`}>{status}</span>
            </div>
            
            {elapsedTime > 0 && (
              <div className="status-row">
                <span className="status-label">경과 시간:</span>
                <span className="status-value">{elapsedTime}초</span>
              </div>
            )}

            {dagRunId && (
              <div className="status-row">
                <span className="status-label">DAG Run ID:</span>
                <span className="status-value">{dagRunId}</span>
              </div>
            )}
          </div>

          {(result || error) && (
            <div className="verification-result-section">
              <h3>검증 결과</h3>
              {error ? (
                <div className="error-message">{error}</div>
              ) : (
                <>
                  <pre className="result-display">{result}</pre>
                  {result && onExecute && code && (
                    <div className="result-actions">
                      <button 
                        className="execute-button"
                        onClick={() => onExecute(code)}
                        disabled={isExecuting}
                      >
                        {isExecuting ? '실행 중...' : '검증된 코드 실행'}
                      </button>
                    </div>
                  )}
                  {executionResult && (
                    <div className="execution-result-section">
                      <h3>실행 결과</h3>
                      <pre className="result-display">{executionResult}</pre>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 
