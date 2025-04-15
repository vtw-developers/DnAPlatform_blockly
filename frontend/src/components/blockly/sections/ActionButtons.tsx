import React from 'react';
import '../styles/Sections.css';

interface ActionButtonsProps {
  onReset: () => void;
  onSave: () => void;
  onToggleShare?: () => void;
  isShared?: boolean;
  showShareButton?: boolean;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onReset,
  onSave,
  onToggleShare,
  isShared,
  showShareButton
}) => {
  return (
    <div className="button-container">
      <button className="reset-button" onClick={onReset}>
        초기화
      </button>
      <button className="save-button" onClick={onSave}>
        저장
      </button>
      {showShareButton && onToggleShare && (
        <button 
          className={`share-button ${isShared ? 'shared' : ''}`} 
          onClick={onToggleShare}
        >
          {isShared ? '공유 해제' : '공유하기'}
        </button>
      )}
    </div>
  );
}; 