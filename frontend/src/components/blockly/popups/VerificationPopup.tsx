import React, { useState } from 'react';
import { VerificationPopupProps } from '../types/blockly.types';
import { codeBlockApi } from '../../../services/api';
import { formatElapsedTime } from '../utils/time';
import '../styles/Popup.css';

export const VerificationPopup: React.FC<VerificationPopupProps> = ({ 
  isOpen, 
  onClose, 
  status, 
  result, 
  elapsedTime 
}) => {
  if (!isOpen) return null;

  const [executionOutput, setExecutionOutput] = useState<string | null>(null);

  const handleExecuteCode = async () => {
    if (!result?.verificationResult?.result_code) return;

    try {
      const executeResult = await codeBlockApi.executeCode(result.verificationResult.result_code);
      setExecutionOutput(executeResult.output || '');
      alert('코드 실행 완료');
      console.log('Execution result:', executeResult);
    } catch (error) {
      console.error('코드 실행 중 오류:', error);
      alert('코드 실행에 실패했습니다.');
    }
  };

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <div className="popup-header">
          <h3>코드 검증</h3>
          {(status === '검증 완료' || status.includes('실패') || status.includes('오류') || status.includes('없음')) && (
            <button className="popup-close" onClick={onClose}>&times;</button>
          )}
        </div>
        <div className="popup-body">
          <div className="execution-status">
            {(status === '검증 진행 중...' || status === '검증 요청 중...') && <div className="status-spinner" />}
            <span>{status}</span>
            {(status === '검증 진행 중...' || status === '검증 요청 중...') && (
              <span className="elapsed-time">
                (소요시간: {formatElapsedTime(elapsedTime)})
              </span>
            )}
          </div>
          {result && (
            <div className={`popup-result ${result.error ? 'error' : (status === '검증 완료' ? 'success' : '')}`}>
              {result.dag_run_id && <p>DAG Run ID: {result.dag_run_id}</p>}
              {result.verificationResult?.result_code !== undefined && (
                <> 
                  <div className="code-snippet">
                    <button onClick={handleExecuteCode} className="code-action-button">
                      실행
                    </button>
                    <pre><code>{result.verificationResult.result_code}</code></pre>
                  </div>
                  <div className="execution-result">
                    <p>{executionOutput !== null ? '실행 결과:' : result.verificationResult.message || '결과:'}</p>
                    <pre><code>{executionOutput !== null ? executionOutput : ''}</code></pre>
                  </div>
                </>
              )}
              {result.error && <pre>오류: {result.error}</pre>}
            </div>
          )}
        </div>
        <div className="popup-footer">
          {(status === '검증 완료' || status.includes('실패') || status.includes('오류') || status.includes('없음')) && (
            <button className="popup-button primary" onClick={onClose}>
              확인
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 
