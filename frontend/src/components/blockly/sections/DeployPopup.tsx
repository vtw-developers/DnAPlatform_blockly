import React, { useState } from 'react';
import './DeployPopup.css';

interface DeployPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (port: number) => void;
  deployLogs: string[];
}

const DeployPopup: React.FC<DeployPopupProps> = ({ isOpen, onClose, onDeploy, deployLogs }) => {
  const [port, setPort] = useState<string>('10000');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const portNumber = parseInt(port, 10);
    if (portNumber >= 10000 && portNumber <= 65535) {
      onDeploy(portNumber);
    } else {
      alert('포트 번호는 10000에서 65535 사이의 값이어야 합니다.');
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
          <div className="button-container">
            <button type="submit" className="deploy-button">배포 시작</button>
            <button type="button" className="cancel-button" onClick={onClose}>취소</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeployPopup; 