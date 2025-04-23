import React, { useState, useEffect } from 'react';
import { codeBlockApi } from '../../../services/api';
import './DeployPopup.css';

interface DeployPopupProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
}

interface ContainerStatus {
  exists: boolean;
  status: string;
  port: number;
  containerId?: string;
}

const DeployPopup: React.FC<DeployPopupProps> = ({ isOpen, onClose, code }) => {
  const [port, setPort] = useState<string>('10000');
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isDeploySuccess, setIsDeploySuccess] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [containerStatus, setContainerStatus] = useState<ContainerStatus>({ 
    exists: false, 
    status: 'not_found',
    port: 10000 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [deployedPort, setDeployedPort] = useState<number | null>(null);

  const fetchContainerStatus = async () => {
    try {
      const response = await codeBlockApi.getContainerStatus(parseInt(port, 10));
      console.log('컨테이너 상태 조회 응답:', response);
      // 배포된 포트에 대해서는 상태를 강제로 running으로 설정
      if (parseInt(port, 10) === deployedPort) {
        const forcedStatus = { ...response, exists: true, status: 'running' };
        setContainerStatus(forcedStatus);
        console.log('설정된 컨테이너 상태 (강제):', forcedStatus);
        return forcedStatus;
      } else {
        setContainerStatus(response);
        console.log('설정된 컨테이너 상태:', response);
        return response;
      }
    } catch (error) {
      console.error('컨테이너 상태 조회 실패:', error);
      const newStatus = { exists: false, status: 'not_found', port: parseInt(port, 10) };
      setContainerStatus(newStatus);
      return newStatus;
    }
  };

  const waitForContainer = async (maxAttempts = 5) => {
    for (let i = 0; i < maxAttempts; i++) {
      console.log(`컨테이너 상태 확인 시도 ${i + 1}/${maxAttempts}`);
      const status = await fetchContainerStatus();
      if (status.exists && status.status === 'running') {
        console.log('컨테이너가 실행 중입니다.');
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
    }
    console.log('컨테이너 상태 확인 실패');
    return false;
  };

  useEffect(() => {
    if (isOpen) {
      fetchContainerStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    console.log('컨테이너 상태 변경됨:', containerStatus);
  }, [containerStatus]);

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

        const lastLog = response.logs?.[response.logs.length - 1] || '';
        const isSuccess = lastLog.includes('배포 완료') || lastLog.includes('Deployment successful');
        setIsDeploySuccess(isSuccess);

        if (isSuccess) {
          setDeployLogs(prev => [...prev, '서비스 테스트가 가능합니다.']);
          setDeployedPort(portNumber); // 배포 성공한 포트 저장
          const newStatus = {
            exists: true,
            status: 'running',
            port: portNumber
          };
          setContainerStatus(newStatus);
          console.log('배포 성공 - 상태 업데이트:', newStatus);
          
          // 컨테이너 상태를 여러 번 확인
          setDeployLogs(prev => [...prev, '컨테이너 상태 확인 중...']);
          const containerReady = await waitForContainer();
          if (!containerReady) {
            setDeployLogs(prev => [...prev, '컨테이너 상태 확인 실패. 잠시 후 다시 시도해주세요.']);
          }
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

  const handleStartContainer = async () => {
    setIsLoading(true);
    try {
      await codeBlockApi.startContainer(parseInt(port, 10));
      setDeployLogs(prev => [...prev, '컨테이너가 시작되었습니다.']);
      await fetchContainerStatus();
    } catch (error) {
      console.error('컨테이너 시작 실패:', error);
      setDeployLogs(prev => [...prev, '컨테이너 시작 중 오류가 발생했습니다.']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopContainer = async () => {
    setIsLoading(true);
    try {
      await codeBlockApi.stopContainer(parseInt(port, 10));
      setDeployLogs(prev => [...prev, '컨테이너가 중지되었습니다.']);
      await fetchContainerStatus();
    } catch (error) {
      console.error('컨테이너 중지 실패:', error);
      setDeployLogs(prev => [...prev, '컨테이너 중지 중 오류가 발생했습니다.']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveContainer = async () => {
    if (window.confirm('컨테이너를 삭제하시겠습니까?')) {
      setIsLoading(true);
      try {
        await codeBlockApi.removeContainer(parseInt(port, 10));
        setDeployLogs(prev => [...prev, '컨테이너가 삭제되었습니다.']);
        setContainerStatus({ exists: false, status: 'not_found', port: parseInt(port, 10) });
      } catch (error) {
        console.error('컨테이너 삭제 실패:', error);
        setDeployLogs(prev => [...prev, '컨테이너 삭제 중 오류가 발생했습니다.']);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleClose = () => {
    if (!isDeploying && !isLoading) {
      setDeployLogs([]);
      setIsDeploySuccess(false);
      setTestResult('');
      setDeployedPort(null); // 팝업 닫을 때 배포된 포트 초기화
      onClose();
    }
  };

  // 테스트 섹션 표시 조건 수정
  const showTestSection = isDeploySuccess || (containerStatus.exists && containerStatus.status === 'running') || deployedPort === parseInt(port, 10);

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

          <div className="container-status">
            <h3>컨테이너 상태</h3>
            <div className="status-info">
              <p>상태: {
                containerStatus.exists && containerStatus.status === 'running' ? '실행 중' :
                containerStatus.exists && containerStatus.status === 'stopped' ? '중지됨' :
                '없음'
              }</p>
              {containerStatus.containerId && (
                <p>컨테이너 ID: {containerStatus.containerId}</p>
              )}
            </div>
            <div className="container-actions">
              {containerStatus.exists && containerStatus.status === 'stopped' && (
                <button
                  type="button"
                  className="start-button"
                  onClick={handleStartContainer}
                  disabled={isLoading}
                >
                  시작
                </button>
              )}
              {containerStatus.exists && containerStatus.status === 'running' && (
                <button
                  type="button"
                  className="stop-button"
                  onClick={handleStopContainer}
                  disabled={isLoading}
                >
                  중지
                </button>
              )}
              {containerStatus.exists && (
                <button
                  type="button"
                  className="remove-button"
                  onClick={handleRemoveContainer}
                  disabled={isLoading}
                >
                  삭제
                </button>
              )}
            </div>
          </div>

          <div className="deploy-logs">
            <h3>배포 로그</h3>
            <div className="logs-container">
              {deployLogs.map((log, index) => (
                <div key={index} className="log-line">{log}</div>
              ))}
            </div>
          </div>

          {showTestSection && (
            <div className="test-section">
              <h3>서비스 테스트</h3>
              <button 
                type="button"
                className="test-button"
                onClick={handleTestService}
                disabled={isLoading}
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
              disabled={isDeploying || isLoading}
            >
              {isDeploying ? '배포 중...' : '배포 시작'}
            </button>
            {!isDeploying && !isLoading && (
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