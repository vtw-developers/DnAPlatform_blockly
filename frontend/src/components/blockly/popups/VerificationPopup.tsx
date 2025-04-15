import React from 'react';
import './VerificationPopup.css';

interface VerificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  status: string;
  result: string | null;
  error: string | null;
  elapsedTime: number;
  dagRunId: string | null;
  code: string;
  isVerifying: boolean;
  onExecute: (code: string) => void;
  executionResult: string | null;
  isExecuting: boolean;
}

const VerificationPopup: React.FC<VerificationPopupProps> = ({
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

  const hasValidationResults = result && !error;
  const canExecute = hasValidationResults && !isExecuting;

  return (
    <div className="popup-overlay">
      <div className="popup-content verification-popup">
        <div className="popup-header">
          <h2>코드 검증 결과</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="popup-body">
          {isVerifying ? (
            <div className="verification-status">
              <p>검증 중... ({elapsedTime}초)</p>
              {dagRunId && <p>DAG Run ID: {dagRunId}</p>}
            </div>
          ) : (
            <div className="verification-results">
              {error ? (
                <div className="error-message">
                  <h3>검증 오류</h3>
                  <pre>{error}</pre>
                </div>
              ) : result ? (
                <>
                  <div className="success-message">
                    <h3>검증 성공</h3>
                    <pre>{result}</pre>
                  </div>
                  {executionResult && (
                    <div className="execution-results">
                      <h3>실행 결과</h3>
                      <pre>{executionResult}</pre>
                    </div>
                  )}
                </>
              ) : null}
              {canExecute && (
                <button 
                  className="execute-button"
                  onClick={() => onExecute(code)}
                  disabled={isExecuting}
                >
                  {isExecuting ? '실행 중...' : '검증된 코드 실행'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerificationPopup; 
