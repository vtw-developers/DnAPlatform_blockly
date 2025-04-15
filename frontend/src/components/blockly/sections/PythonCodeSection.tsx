import React from 'react';
import '../styles/Sections.css';

interface PythonCodeSectionProps {
  code: string;
  onExecute: () => void;
  onConvert: () => void;
  isConverting: boolean;
}

export const PythonCodeSection: React.FC<PythonCodeSectionProps> = ({
  code,
  onExecute,
  onConvert,
  isConverting
}) => {
  return (
    <div className="code-group">
      <h3 className="section-title">생성된 Python 코드</h3>
      <textarea
        value={code}
        readOnly
        className="python-code-display"
      />
      <div className="code-actions">
        <button className="action-button" onClick={onExecute}>
          코드 실행
        </button>
        <button 
          className="action-button" 
          onClick={onConvert}
          disabled={!code.trim() || isConverting}
        >
          {isConverting ? '변환 중...' : '코드 변환'}
        </button>
      </div>
    </div>
  );
}; 