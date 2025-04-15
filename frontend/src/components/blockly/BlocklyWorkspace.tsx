import React, { useRef, useState } from 'react';
import { BlocklyWorkspaceProps } from './types/blockly.types';
import { useBlocklySetup } from './hooks/useBlocklySetup';
import { useCodeExecution } from './hooks/useCodeExecution';
import { useVerification } from './hooks/useVerification';
import { useConversion } from './hooks/useConversion';
import { useCodeBlock } from './hooks/useCodeBlock';
import { useModels } from './hooks/useModels';
import { usePopups } from './hooks/usePopups';
import { ExecutionPopup } from './popups/ExecutionPopup';
import { NaturalLanguagePopup } from './popups/NaturalLanguagePopup';
import VerificationPopup from './popups/VerificationPopup';
import { ConversionPopup } from './popups/ConversionPopup';
import { RightPanel } from './panels/RightPanel';
import { useAuth } from '../../contexts/AuthContext';
import { TOOLBOX_CONFIG } from './configs/toolboxConfig';
import './styles/BlocklyWorkspace.css';

const BlocklyWorkspace: React.FC<BlocklyWorkspaceProps> = ({ onCodeGenerate }) => {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [currentCode, setCurrentCode] = useState<string>('');
  const [shouldRefresh, setShouldRefresh] = useState(false);
  const { user } = useAuth();
  
  const { isOpen, openPopup, closePopup } = usePopups();
  const {
    models,
    selectedModel,
    setSelectedModel,
    isLoadingModels
  } = useModels();

  const { workspace, resetWorkspace } = useBlocklySetup({
    workspaceRef,
    toolboxConfig: TOOLBOX_CONFIG,
    onCodeChange: (code: string) => {
      setCurrentCode(code);
      onCodeGenerate(code);
    }
  });

  const {
    title,
    description,
    isShared,
    selectedBlocks,
    selectedBlockUserId,
    setTitle,
    setDescription,
    handleSave,
    handleCreateBlock,
    handleBlockSelect,
    handleToggleShare,
    handleReset: handleCodeBlockReset
  } = useCodeBlock({
    workspace,
    currentCode,
    onRefresh: () => setShouldRefresh(true)
  });

  const {
    isConversionPopupOpen,
    conversionStatus,
    conversionError,
    convertedCode,
    isConverting,
    conversionDagRunId,
    conversionElapsedTime,
    handleConvert,
    handleCloseConversionPopup
  } = useConversion();

  const {
    verificationStatus,
    verificationResult,
    verificationElapsedTime,
    isVerifying,
    handleVerifyCode,
    handleCloseVerificationPopup,
    verificationDagRunId,
    verificationError
  } = useVerification();

  const {
    executeCode,
    executionStatus,
    executionResult,
    closeExecutionPopup
  } = useCodeExecution();

  const handleExecute = () => {
    openPopup('execution');
    executeCode(currentCode);
  };

  const handleExecuteVerifiedCode = async (code: string) => {
    executeCode(code);
  };

  const handleRefreshComplete = () => {
    setShouldRefresh(false);
  };

  const handleReset = () => {
    resetWorkspace();
    handleCodeBlockReset();
  };

  const handleCloseExecutionPopup = () => {
    closeExecutionPopup();
    closePopup('execution');
  };

  const handleConvertCode = (code: string) => {
    openPopup('conversion');
    handleConvert(code);
  };

  const handleVerifyCodeWithModel = (code: string, model: string) => {
    openPopup('verification');
    handleVerifyCode(code, model);
  };

  return (
    <div className="blockly-container">
      <div className="blockly-workspace-container">
        <div ref={workspaceRef} className="blockly-workspace" />
      </div>

      <RightPanel
        title={title}
        description={description}
        currentCode={currentCode}
        convertedCode={convertedCode}
        isShared={isShared}
        selectedBlocks={selectedBlocks}
        selectedBlockUserId={selectedBlockUserId}
        isConverting={isConverting}
        isVerifying={isVerifying}
        models={models}
        selectedModel={selectedModel}
        isLoadingModels={isLoadingModels}
        shouldRefresh={shouldRefresh}
        currentUser={user}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onReset={handleReset}
        onSave={handleSave}
        onToggleShare={handleToggleShare}
        onExecute={handleExecute}
        onConvert={handleConvertCode}
        onVerify={handleVerifyCodeWithModel}
        onModelSelect={setSelectedModel}
        onBlockSelect={handleBlockSelect}
        onRefreshComplete={handleRefreshComplete}
        onDeleteComplete={resetWorkspace}
        openPopup={openPopup}
      />

      <ExecutionPopup
        isOpen={isOpen.execution}
        onClose={handleCloseExecutionPopup}
        status={executionStatus}
        result={executionResult}
      />

      <NaturalLanguagePopup
        isOpen={isOpen.naturalLanguage}
        onClose={() => closePopup('naturalLanguage')}
        onCreateBlock={handleCreateBlock}
      />

      <VerificationPopup
        isOpen={isOpen.verification}
        onClose={() => {
          handleCloseVerificationPopup();
          closePopup('verification');
        }}
        status={verificationStatus}
        result={verificationResult}
        error={verificationError}
        elapsedTime={verificationElapsedTime}
        dagRunId={verificationDagRunId}
        code={currentCode}
        isVerifying={isVerifying}
        onExecute={handleExecuteVerifiedCode}
        executionResult={executionResult?.output ?? executionResult?.error ?? null}
        isExecuting={executionStatus === '실행 중'}
      />

      <ConversionPopup
        isOpen={isOpen.conversion}
        onClose={() => {
          handleCloseConversionPopup();
          closePopup('conversion');
        }}
        status={conversionStatus}
        dagRunId={conversionDagRunId}
        error={conversionError}
        isConverting={isConverting}
        elapsedTime={conversionElapsedTime}
      />
    </div>
  );
};

export default BlocklyWorkspace; 