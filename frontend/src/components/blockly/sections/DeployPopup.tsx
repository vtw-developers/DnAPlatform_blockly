import React, { useState } from 'react';
import { codeBlockApi } from '../../../services/api';
import './DeployPopup.css';

interface DeployPopupProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
}

const DeployPopup: React.FC<DeployPopupProps> = ({ isOpen, onClose, code }) => {
  const [port, setPort] = useState<string>('10000');
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isDeploySuccess, setIsDeploySuccess] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const portNumber = parseInt(port, 10);
    
    if (portNumber >= 10000 && portNumber <= 65535) {
      setIsDeploying(true);
      setIsDeploySuccess(false);
      setTestResult('');
      setDeployLogs([`배포 시작: 포트 ${port} 사용...`]);

      try {
        const response = await codeBlockApi.deployService(code, portNumber);
        
        if (response.logs) {
          setDeployLogs(prev => [...prev, ...response.logs]);
        }

        // 배포 성공 여부 확인
        const lastLog = response.logs?.[response.logs.length - 1] || '';
        const isSuccess = lastLog.includes('배포 완료') || lastLog.includes('Deployment successful');
        setIsDeploySuccess(isSuccess);

        if (isSuccess) {
          setDeployLogs(prev => [...prev, '서비스 테스트가 가능합니다.']);
        }
      } catch (error) {
        console.error('배포 오류:', error);
        setDeployLogs(prev => [...prev, '배포 중 오류 발생']);
        setIsDeploySuccess(false);
      } finally {
        setIsDeploying(false);
      }
    } else {
      alert('포트 번호는 10000에서 65535 사이의 값이어야 합니다.');
    }
  };

  const handleTestService = async () => {
    try {
      const response = await fetch(`http://localhost:${port}/test`, {
        method: 'GET',
      });
      const data = await response.json();
      setTestResult(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('테스트 오류:', error);
      setTestResult('서비스 테스트 중 오류가 발생했습니다.');
    }
  };

  const handleClose = () => {
    if (!isDeploying) {
      setDeployLogs([]);
      setIsDeploySuccess(false);
      setTestResult('');
      onClose();
    }
  };

  return (
    <div className="deploy-popup-overlay">
      <div className="deploy-popup">
        <h2>운영 배포</h2>
        <form onSubmit={handleSubmit}>
          <div className="port-input-container">
            <label htmlFor="port">서비스 포트:</label>
            <input
              type="number"
              id="port"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              min="10000"
              max="65535"
              required
              disabled={isDeploying}
            />
          </div>
          <div className="deploy-logs">
            <h3>배포 로그</h3>
            <div className="logs-container">
              {deployLogs.map((log, index) => (
                <div key={index} className="log-line">{log}</div>
              ))}
            </div>
          </div>
          {isDeploySuccess && (
            <div className="test-section">
              <h3>서비스 테스트</h3>
              <button 
                type="button"
                className="test-button"
                onClick={handleTestService}
              >
                테스트 실행
              </button>
              {testResult && (
                <div className="test-result">
                  <h4>테스트 결과:</h4>
                  <pre>{testResult}</pre>
                </div>
              )}
            </div>
          )}
          <div className="button-container">
            <button 
              type="submit" 
              className="deploy-button"
              disabled={isDeploying}
            >
              {isDeploying ? '배포 중...' : '배포 시작'}
            </button>
            {!isDeploying && (
              <button 
                type="button" 
                className="close-button" 
                onClick={handleClose}
              >
                닫기
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeployPopup; 