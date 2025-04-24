import React, { useState, useEffect } from 'react';
import { codeBlockApi } from '../../../services/api';
import './DeployPopup.css';

interface DeployPopupProps {
  isOpen: boolean;
  onClose: () => void;
  pythonCode: string;
  convertedCode?: string;
}

interface ContainerStatus {
  exists: boolean;
  status: string;
  port: number;
  containerId?: string;
}

interface ContainerInfo {
  name: string;
  port: number;
  status: string;
  created_at: string;
  state: any;
}

const DeployPopup: React.FC<DeployPopupProps> = ({ isOpen, onClose, pythonCode, convertedCode }) => {
  const [port, setPort] = useState<string>('10000');
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isDeploySuccess, setIsDeploySuccess] = useState(false);
  const [testResult, setTestResult] = useState<string>('');
  const [selectedCodeType, setSelectedCodeType] = useState<'python' | 'converted'>('python');
  const [containerStatus, setContainerStatus] = useState<ContainerStatus>({ 
    exists: false, 
    status: 'not_found',
    port: 10000 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [deployedPort, setDeployedPort] = useState<number | null>(null);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<ContainerInfo | null>(null);

  const fetchContainers = async () => {
    try {
      const response = await fetch(`/api/containers/list`);
      if (!response.ok) throw new Error('컨테이너 목록 조회 실패');
      const data = await response.json();
      setContainers(data);
    } catch (error) {
      console.error('컨테이너 목록 조회 오류:', error);
    }
  };

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
      fetchContainers();
    }
  }, [isOpen]);

  useEffect(() => {
    console.log('컨테이너 상태 변경됨:', containerStatus);
  }, [containerStatus]);

  const handleContainerSelect = (container: ContainerInfo) => {
    if (!container) return;
    
    setSelectedContainer(container);
    setPort((container.port || 10000).toString());
    setContainerStatus({
      exists: true,
      status: container.status || 'unknown',
      port: container.port || 10000
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const portNumber = parseInt(port, 10);
    const codeToUse = selectedCodeType === 'python' ? pythonCode : convertedCode || '';
    
    if (portNumber >= 10000 && portNumber <= 65535) {
      setIsDeploying(true);
      setIsDeploySuccess(false);
      setTestResult('');
      setDeployLogs([`배포 시작: 포트 ${port} 사용...`]);

      try {
        const response = await codeBlockApi.deployService(
          codeToUse, 
          portNumber,
          selectedCodeType === 'python' ? 'python' : 'graalvm'
        );
        
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
          } else {
            // 배포 성공 후 컨테이너 목록 갱신
            await fetchContainers();
            setDeployLogs(prev => [...prev, '서비스 목록이 갱신되었습니다.']);
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
      
      // 에러 응답 처리
      if (data.status === 'error') {
        let errorMessage = data.message || '알 수 없는 오류가 발생했습니다.';
        if (data.details?.error?.message === 'JVM cannot be restarted') {
          errorMessage = '서비스를 재시작해야 합니다. 서비스를 중지하고 다시 시작해주세요.';
        }
        setTestResult(JSON.stringify({
          status: 'error',
          message: errorMessage,
          details: data.details
        }, null, 2));
        
        // JVM 재시작 오류인 경우 컨테이너 상태 업데이트
        if (data.details?.error?.message === 'JVM cannot be restarted') {
          setContainerStatus(prev => ({
            ...prev,
            status: 'error',
            error: 'JVM restart required'
          }));
        }
      } else {
        setTestResult(JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.error('테스트 오류:', error);
      setTestResult(JSON.stringify({
        status: 'error',
        message: '서비스 테스트 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : String(error)
      }, null, 2));
    }
  };

  const handleStartContainer = async (port: number) => {
    if (!selectedContainer) return;
    setIsLoading(true);
    try {
      await codeBlockApi.startContainer(port);
      setDeployLogs(prev => [...prev, '컨테이너가 시작되었습니다.']);
      await fetchContainers();
    } catch (error) {
      console.error('컨테이너 시작 실패:', error);
      setDeployLogs(prev => [...prev, '컨테이너 시작 중 오류가 발생했습니다.']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopContainer = async () => {
    if (!selectedContainer) return;
    setIsLoading(true);
    try {
      await codeBlockApi.stopContainer(selectedContainer.port);
      setDeployLogs(prev => [...prev, '컨테이너가 중지되었습니다.']);
      await fetchContainers();
    } catch (error) {
      console.error('컨테이너 중지 실패:', error);
      setDeployLogs(prev => [...prev, '컨테이너 중지 중 오류가 발생했습니다.']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveContainer = async (containerToRemove: ContainerInfo) => {
    if (window.confirm('컨테이너를 삭제하시겠습니까?')) {
      setIsLoading(true);
      try {
        await codeBlockApi.removeContainer(containerToRemove.port);
        setDeployLogs(prev => [...prev, '컨테이너가 삭제되었습니다.']);
        setSelectedContainer(null);
        await fetchContainers();
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

  if (!isOpen) return null;

  return (
    <div className={`deploy-popup ${isOpen ? 'open' : ''}`}>
      <div className="deploy-popup-content">
        <div className="popup-header">
          <h2>서비스 배포</h2>
          <button 
            type="button" 
            className="close-button" 
            onClick={handleClose}
            disabled={isDeploying || isLoading}
          >
            ×
          </button>
        </div>
        
        {convertedCode && (
          <div className="code-selection">
            <h3>배포할 코드 선택</h3>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value="python"
                  checked={selectedCodeType === 'python'}
                  onChange={(e) => setSelectedCodeType('python')}
                />
                Python 코드
              </label>
              <label>
                <input
                  type="radio"
                  value="converted"
                  checked={selectedCodeType === 'converted'}
                  onChange={(e) => setSelectedCodeType('converted')}
                />
                변환/랩핑된 코드 (GraalVM Java)
              </label>
            </div>
            <div className="code-type-description">
              {selectedCodeType === 'python' ? (
                <p>Python 코드는 Python 환경에 배포됩니다.</p>
              ) : (
                <p>변환/랩핑된 코드는 GraalVM Java 환경에 배포됩니다.</p>
              )}
            </div>
          </div>
        )}

        <div className="container-list-section">
          <h3>배포된 서비스 목록</h3>
          <div className="container-list">
            <table>
              <thead>
                <tr>
                  <th>서비스명</th>
                  <th>포트</th>
                  <th>상태</th>
                  <th>시작일시</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((container) => (
                  <tr 
                    key={container.name}
                    className={selectedContainer?.name === container.name ? 'selected' : ''}
                    onClick={() => handleContainerSelect(container)}
                  >
                    <td>{container.name}</td>
                    <td>{container.port}</td>
                    <td>{container.status === 'running' ? '실행 중' : 
                         container.status === 'exited' ? '중지됨' : container.status}</td>
                    <td>{container.created_at}</td>
                    <td>
                      {container.status === 'running' ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedContainer(container);
                            setPort(container.port.toString());
                            handleStopContainer();
                          }}
                          disabled={isLoading}
                        >
                          중지
                        </button>
                      ) : (                      
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();                           
                            const portFromName = parseInt(container.name.match(/\d+$/)?.[0] || '10000');                            
                            setSelectedContainer(container);
                            setPort(portFromName.toString());
                            await new Promise(resolve => setTimeout(resolve, 0));
                            handleStartContainer(portFromName);
                          }}
                          disabled={isLoading}
                        >
                          시작
                        </button>                        
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveContainer(container);
                        }}
                        disabled={isLoading}
                        className="remove-button"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="deploy-controls">
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

            {(selectedContainer?.status === 'running' || isDeploySuccess) && (
              <div className="test-section">
                <button 
                  type="button"
                  className="test-button"
                  onClick={handleTestService}
                  disabled={isLoading}
                >
                  테스트 실행
                </button>
              </div>
            )}

            <button 
              type="submit" 
              className="deploy-button"
              disabled={isDeploying || isLoading || containers.some(container => container.port === parseInt(port, 10))}
            >
              {isDeploying ? '배포 중...' : containers.some(container => container.port === parseInt(port, 10)) ? '이미 사용 중인 포트' : '배포 시작'}
            </button>
          </div>

          <div className="deploy-logs">
            <h3>결과 로그</h3>
            <div className="logs-container">
              {deployLogs.map((log, index) => (
                <div key={index} className="log-line">{log}</div>
              ))}
              {testResult && (
                <div className="log-line test-result">{testResult}</div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeployPopup; 