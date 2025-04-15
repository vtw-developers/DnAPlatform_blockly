import React from 'react';
import { CodeBlockList } from '../../../components/CodeBlockList';
import { CodeBlock } from '../../../types/CodeBlock';
import '../styles/Sections.css';

interface SavedCodesSectionProps {
  onSelectBlock: (block: CodeBlock) => void;
  shouldRefresh: boolean;
  onRefreshComplete: () => void;
  onDeleteComplete: () => void;
  currentUser?: {
    id: number;
    email: string;
    name: string;
  };
  onToggleShare?: (block: CodeBlock) => void;
}

export const SavedCodesSection: React.FC<SavedCodesSectionProps> = ({
  onSelectBlock,
  shouldRefresh,
  onRefreshComplete,
  onDeleteComplete,
  currentUser,
  onToggleShare
}) => {
  return (
    <div className="saved-codes-section">
      <h3 className="section-title">저장된 코드 목록</h3>
      <CodeBlockList
        onSelectBlock={onSelectBlock}
        shouldRefresh={shouldRefresh}
        onRefreshComplete={onRefreshComplete}
        onDeleteComplete={onDeleteComplete}
        currentUser={currentUser}
        onToggleShare={onToggleShare}
      />
    </div>
  );
}; 