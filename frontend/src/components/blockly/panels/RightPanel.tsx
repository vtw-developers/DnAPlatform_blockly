import React, { useCallback, useState } from 'react';
import { User } from '../../../types/auth.types';
import { Model } from '../types/model.types';
import { CodeBlock } from '../../../types/CodeBlock';
import { CodeInputSection } from '../sections/CodeInputSection';
import { ActionButtons } from '../sections/ActionButtons';
import { ConvertedCodeSection } from '../sections/ConvertedCodeSection';
import { VerificationSection } from '../sections/VerificationSection';
import { SavedCodesSection } from '../sections/SavedCodesSection';
import { RulesManagementModal } from '../sections/RulesManagementModal';
import { PopupType } from '../hooks/usePopups';
import './RightPanel.css';

interface RightPanelProps {
  title: string;
  description: string;
  currentCode: string;
  isShared: boolean;
  selectedBlocks: number[];
  selectedBlockUserId: number | null;
  isConverting: boolean;
  isVerifying: boolean;
  models: Model[];
  selectedModel: Model | null;
  isLoadingModels: boolean;
  shouldRefresh: boolean;
  currentUser: User | null;
  wrappedCode: string;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onReset: () => void;
  onSave: (userId: number | null) => Promise<void>;
  onToggleShare: (userId: number | null, block: CodeBlock) => Promise<void>;
  onExecute: () => void;
  onConvert: (code: string) => void;
  onVerify: (code: string, model: Model | null, temperature?: number) => void;
  onDeploy: () => void;
  onModelSelect: (model: Model | null) => void;
  onBlockSelect: (block: CodeBlock) => void;
  onRefreshComplete: () => void;
  onDeleteComplete: () => void;
  openPopup: (type: PopupType) => void;
  onLapping: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  title,
  description,
  currentCode,
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
  onLapping,
  onDeploy,
  wrappedCode,  
}) => {
  // temperature 상태 관리
  const [temperature, setTemperature] = useState<number>(0);
  // 변환규칙 관리 모달 상태
  const [isRulesModalOpen, setIsRulesModalOpen] = useState<boolean>(false);

  const handleConvert = useCallback(() => {
    onConvert(currentCode);
  }, [onConvert, currentCode]);

  const handleVerify = useCallback((temp: number) => {
    onVerify(currentCode, selectedModel, temp);
  }, [onVerify, currentCode, selectedModel]);

  const handleTemperatureChange = useCallback((temp: number) => {
    setTemperature(temp);
  }, []);

  return (
    <div className="right-panel">
      <div className="button-container">
        <button
          className="action-button"
          style={{ marginBottom: '10px' }}
          onClick={() => openPopup('naturalLanguage')}
        >
          자연어로 블록 생성
        </button>
      </div>
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
        wrappedCode={wrappedCode}
        onLapping={onLapping}
        onDeploy={onDeploy}
        onShowRules={() => setIsRulesModalOpen(true)}
      />

      <ConvertedCodeSection
        convertedCode={wrappedCode}                
      />

      <VerificationSection
        selectedModel={selectedModel}
        models={models}
        isLoadingModels={isLoadingModels}
        isVerifying={isVerifying}
        onModelSelect={onModelSelect}
        onVerify={handleVerify}
        disabled={isVerifying || !currentCode || !selectedModel || isLoadingModels}
        temperature={temperature}
        onTemperatureChange={handleTemperatureChange}
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
      
      {/* 변환규칙 관리 모달 */}
      <RulesManagementModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
      />
    </div>
  );
}; 