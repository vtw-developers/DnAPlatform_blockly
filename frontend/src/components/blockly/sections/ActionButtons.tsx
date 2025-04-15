import React from 'react';
import '../styles/Sections.css';

interface ActionButtonsProps {
  onReset: () => void;
  onSave: () => void;
  onToggleShare?: () => void;
  onExecute: () => void;
  onConvert: () => void;
  isShared?: boolean;
  showShareButton?: boolean;
  isConverting?: boolean;
  code: string;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onReset,
  onSave,
  onExecute,
  onConvert,
  isConverting,
  code
}) => {
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
        <button className="action-button" onClick={onConvert} disabled={!code?.trim() || isConverting}>
          {isConverting ? '변환 중...' : '코드변환'}
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
    </div>
  );
}; 