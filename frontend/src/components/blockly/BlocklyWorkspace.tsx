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
import { VerificationPopup } from './popups/VerificationPopup';
import { ConversionPopup } from './popups/ConversionPopup';
import { CodeBlockList } from '../../components/CodeBlockList';
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
      <div className="right-panel">
        <div className="code-input-container">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="코드 제목"
            className="code-title-input"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="코드 설명"
            className="code-description-input"
          />
        </div>
        <div className="button-container">
          <button className="reset-button" onClick={handleReset}>
            초기화
          </button>
          <button className="save-button" onClick={() => handleSave(user?.id ?? null)}>
            저장
          </button>
          {selectedBlocks.length > 0 && user && user.id === selectedBlockUserId && (
            <button 
              className={`share-button ${isShared ? 'shared' : ''}`} 
              onClick={() => handleToggleShare(user?.id ?? null)}
            >
              {isShared ? '공유 해제' : '공유하기'}
            </button>
          )}
        </div>
        <div className="code-group">
          <h3 className="section-title">생성된 Python 코드</h3>
          <textarea
            value={currentCode}
            readOnly
            className="python-code-display"
          />
          <div className="code-actions">
            <button className="action-button" onClick={handleExecute}>
              코드 실행
            </button>
            <button 
              className="action-button" 
              onClick={() => handleConvertCode(currentCode)}
              disabled={!currentCode.trim() || isConverting}
            >
              {isConverting ? '변환 중...' : '코드 변환'}
            </button>
          </div>
        </div>
        <div className="code-group">
          <h3 className="section-title">변환된 코드</h3>
          <textarea
            value={convertedCode}
            readOnly
            placeholder="변환된 코드가 여기에 표시됩니다"
            className="python-code-display"
          />
        </div>
        <div className="verification-section">
          <h3 className="section-title">코드 검증</h3>
          <div className="verify-container">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="model-select"
              disabled={isLoadingModels || models.length === 0}
            >
              {isLoadingModels ? (
                <option key="loading" value="">모델 목록 로딩 중...</option>
              ) : models.length === 0 ? (
                <option key="empty" value="">사용 가능한 모델이 없습니다</option>
              ) : (
                <>
                  <optgroup label="OpenAI 모델" key="openai-group">
                    {models.filter(m => m.type === 'openai').map((model) => (
                      <option key={`verify-openai-${model.name}`} value={model.name}>
                        {model.name} {model.description ? `- ${model.description}` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Ollama 모델" key="ollama-group">
                    {models.filter(m => m.type === 'ollama').map((model) => (
                      <option key={`verify-ollama-${model.name}`} value={model.name}>
                        {model.name} {model.description ? `- ${model.description}` : ''}
                      </option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
            <button
              onClick={() => handleVerifyCodeWithModel(currentCode, selectedModel)}
              disabled={isVerifying || !currentCode || !selectedModel || isLoadingModels}
              className="verify-button"
            >
              {isVerifying ? '검증 중...' : '코드 검증'}
            </button>
          </div>
        </div>
        <div className="saved-codes-section">
          <h3 className="section-title">저장된 코드 목록</h3>
          <CodeBlockList
            onSelectBlock={handleBlockSelect}
            shouldRefresh={shouldRefresh}
            onRefreshComplete={handleRefreshComplete}
            onDeleteComplete={resetWorkspace}
            currentUser={user ? {
              id: user.id,
              email: user.email,
              name: user.name
            } : undefined}
          />
        </div>
      </div>

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
        executionResult={executionResult?.output || executionResult?.error}
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