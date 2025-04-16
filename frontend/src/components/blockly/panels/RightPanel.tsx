import React, { useCallback } from 'react';
import { User } from '../../../types/auth.types';
import { Model } from '../types/model.types';
import { CodeBlock } from '../../../types/CodeBlock';
import { CodeInputSection } from '../sections/CodeInputSection';
import { ActionButtons } from '../sections/ActionButtons';
import { ConvertedCodeSection } from '../sections/ConvertedCodeSection';
import { VerificationSection } from '../sections/VerificationSection';
import { SavedCodesSection } from '../sections/SavedCodesSection';
import { PopupType } from '../hooks/usePopups';
import './RightPanel.css';

interface RightPanelProps {
  title: string;
  description: string;
  currentCode: string;
  convertedCode: string;
  isShared: boolean;
  selectedBlocks: number[];
  selectedBlockUserId: number | null;
  isConverting: boolean;
  isVerifying: boolean;
  models: Model[];
  selectedModel: string;
  isLoadingModels: boolean;
  shouldRefresh: boolean;
  currentUser: User | null;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onReset: () => void;
  onSave: (userId: number | null) => Promise<void>;
  onToggleShare: (userId: number | null, block: CodeBlock) => Promise<void>;
  onExecute: () => void;
  onConvert: (code: string) => void;
  onVerify: (code: string, model: string) => void;
  onModelSelect: (model: string) => void;
  onBlockSelect: (block: CodeBlock) => void;
  onRefreshComplete: () => void;
  onDeleteComplete: () => void;
  openPopup: (type: PopupType) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  title,
  description,
  currentCode,
  convertedCode,
  isShared,
  selectedBlocks,
  selectedBlockUserId,
  isConverting,
  isVerifying,
  models,
  selectedModel,
  isLoadingModels,
  shouldRefresh,
  currentUser,
  onTitleChange,
  onDescriptionChange,
  onReset,
  onSave,
  onToggleShare,
  onExecute,
  onConvert,
  onVerify,
  onModelSelect,
  onBlockSelect,
  onRefreshComplete,
  onDeleteComplete,
  openPopup,
}) => {
  const handleConvert = useCallback(() => {
    onConvert(currentCode);
  }, [onConvert, currentCode]);

  const handleVerify = useCallback(() => {
    onVerify(currentCode, selectedModel);
  }, [onVerify, currentCode, selectedModel]);

  return (
    <div className="right-panel">
      <button
        className="action-button"
        style={{ marginBottom: '10px' }}
        onClick={() => openPopup('naturalLanguage')}
      >
        자연어로 블록 생성
      </button>
      <CodeInputSection
        title={title}
        description={description}
        onTitleChange={onTitleChange}
        onDescriptionChange={onDescriptionChange}
      />
      
      <ActionButtons
        onReset={onReset}
        onSave={() => onSave(currentUser?.id ?? null)}
        onExecute={onExecute}
        onConvert={handleConvert}
        isConverting={isConverting}
        code={currentCode}
      />

      <ConvertedCodeSection
        convertedCode={convertedCode}
      />

      <VerificationSection
        selectedModel={selectedModel}
        models={models}
        isLoadingModels={isLoadingModels}
        isVerifying={isVerifying}
        onModelSelect={onModelSelect}
        onVerify={handleVerify}
        disabled={isVerifying || !currentCode || !selectedModel || isLoadingModels}
      />

      <SavedCodesSection
        onSelectBlock={onBlockSelect}
        shouldRefresh={shouldRefresh}
        onRefreshComplete={onRefreshComplete}
        onDeleteComplete={onDeleteComplete}
        currentUser={currentUser ? {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name
        } : undefined}
        onToggleShare={(block) => onToggleShare(currentUser?.id ?? null, block)}
      />
    </div>
  );
}; 