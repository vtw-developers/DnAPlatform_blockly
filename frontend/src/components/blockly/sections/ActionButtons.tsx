import React, { useState } from 'react';
import DeployPopup from './DeployPopup';
import './ActionButtons.css';

interface ActionButtonsProps {
  code: string;
  isConverting: boolean;
  convertedCode?: string;
  wrappedCode?: string;
  onReset: () => void;
  onSave: () => void;
  onExecute: () => void;
  onConvert: () => void;
  onLapping: () => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  code,
  isConverting,
  convertedCode,
  wrappedCode,
  onReset,
  onSave,
  onExecute,
  onConvert,
  onLapping,
}) => {
  const [isDeployPopupOpen, setIsDeployPopupOpen] = useState(false);

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
      </div>
      <div className="code-group">
        <h3 className="section-title">생성된 Python 코드</h3>
        <textarea
          value={code}
          readOnly
          placeholder="생성된 Python 코드가 여기에 표시됩니다"
          className="python-code-display"
        />
      </div>
      <div className="button-container">
        <button 
          className="action-button" 
          onClick={onConvert} 
          disabled={!code?.trim() || isConverting}
        >
          {isConverting ? '변환 중...' : '코드변환'}
        </button>
        <button className="action-button" onClick={onLapping} disabled={!code?.trim()}>
          코드랩핑
        </button>
        <button 
          className="deploy-button" 
          onClick={() => setIsDeployPopupOpen(true)}
          disabled={!code?.trim()}
        >
          운영배포
        </button>
      </div>
      <DeployPopup
        isOpen={isDeployPopupOpen}
        onClose={() => setIsDeployPopupOpen(false)}
        pythonCode={code}
        convertedCode={convertedCode || wrappedCode}
      />
    </div>
  );
}; 