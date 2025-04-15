import React, { useState } from 'react';
import { codeBlockApi } from '../../../services/api';
import { VerificationPopupProps } from '../types/blockly.types';
import { formatElapsedTime } from '../utils/time';
import '../styles/Popup.css';

export const VerificationPopup: React.FC<VerificationPopupProps> = ({
  isOpen,
  onClose,
  status,
  result,
  elapsedTime,
  dagRunId,
  error
}) => {
  const [executionOutput, setExecutionOutput] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  if (!isOpen) return null;

  const handleExecuteCode = async () => {
    if (!result) return;

    try {
      setIsExecuting(true);
      const executeResult = await codeBlockApi.executeCode(result);
      setExecutionOutput(executeResult.output || '실행 결과가 없습니다.');
    } catch (error) {
      console.error('코드 실행 중 오류:', error);
      setExecutionOutput(error instanceof Error ? error.message : '코드 실행에 실패했습니다.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="popup-overlay">
      <div className="popup-content verification-popup">
        <div className="popup-header">
          <h2>코드 검증</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="popup-body">
          <div className="status-section">
            <div className="status-info">
              <p><strong>상태:</strong> {status}</p>
              <p><strong>경과 시간:</strong> {formatElapsedTime(elapsedTime)}</p>
              {dagRunId && (
                <p><strong>DAG 실행 ID:</strong> {dagRunId}</p>
              )}
            </div>

            {error ? (
              <div className="error-section">
                <h3>오류 발생</h3>
                <div className="error-message">
                  {error}
                </div>
              </div>
            ) : result ? (
              <div className="result-section">
                <div className="code-header">
                  <h3>검증 결과</h3>
                  <button 
                    className="execute-button"
                    onClick={handleExecuteCode}
                    disabled={isExecuting}
                  >
                    {isExecuting ? '실행 중...' : '실행'}
                  </button>
                </div>
                <div className="code-container">
                  <pre className="code-block">
                    <code>{result}</code>
                  </pre>
                </div>
                {executionOutput && (
                  <div className="execution-output">
                    <h3>실행 결과</h3>
                    <pre className="output-block">
                      <code>{executionOutput}</code>
                    </pre>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="popup-footer">
          <button 
            className="popup-button primary" 
            onClick={onClose}
            disabled={status === '검증 진행 중...'}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}; 
