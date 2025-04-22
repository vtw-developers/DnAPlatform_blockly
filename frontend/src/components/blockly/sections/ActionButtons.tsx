import React, { useState } from 'react';
import DeployPopup from './DeployPopup';
import './ActionButtons.css';

interface ActionButtonsProps {
  code: string;
  isConverting: boolean;
  onReset: () => void;
  onSave: () => void;
  onExecute: () => void;
  onConvert: () => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  code,
  isConverting,
  onReset,
  onSave,
  onExecute,
  onConvert,
}) => {
  const [isDeployPopupOpen, setIsDeployPopupOpen] = useState(false);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);

  const handleDeploy = async (port: number) => {
    try {
      setDeployLogs(prev => [...prev, `배포 시작: 포트 ${port} 사용`]);
      
      const response = await fetch('/api/deploy/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          port,
          code 
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail?.message || data.detail || '배포 중 오류가 발생했습니다.');
      }

      // 로그 업데이트
      if (data.logs) {
        setDeployLogs(prev => [...prev, ...data.logs]);
      }

      // 성공 시 3초 후 팝업 닫기
      if (data.status === 'success') {
        setTimeout(() => {
          setIsDeployPopupOpen(false);
          setDeployLogs([]);
        }, 3000);
      }
    } catch (error: any) {
      setDeployLogs(prev => [...prev, `오류: ${error.message}`]);
    }
  };

  return (
    <div>
      <div className="button-container">
        <button className="reset-button" onClick={onReset}>
          초기화
        </button>
        <button className="save-button" onClick={onSave}>
          저장
        </button>       
        <button className="action-button" onClick={onExecute}>
          코드실행
        </button>
        <button 
          className="action-button" 
          onClick={onConvert} 
          disabled={!code?.trim() || isConverting}
        >
          {isConverting ? '변환 중...' : '코드변환'}
        </button>
        <button 
          className="deploy-button" 
          onClick={() => setIsDeployPopupOpen(true)}
          disabled={!code?.trim()}
        >
          운영배포
        </button>
      </div>
      <div className="code-group">
        <h3 className="section-title">생성된 Python 코드</h3>
        <textarea
          value={code}
          readOnly
          className="python-code-display"
        />
      </div>
      <DeployPopup
        isOpen={isDeployPopupOpen}
        onClose={() => {
          setIsDeployPopupOpen(false);
          setDeployLogs([]);
        }}
        onDeploy={handleDeploy}
        deployLogs={deployLogs}
      />
    </div>
  );
}; 