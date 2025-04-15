import React from 'react';
import { CodeBlockList } from '../../../components/CodeBlockList';
import { User } from '../../../types/auth.types';
import { Model } from '../types/model.types';
import { CodeBlock } from '../../../types/codeBlock.types';
import './RightPanel.css';

interface RightPanelProps {
  title: string;
  description: string;
  currentCode: string;
  convertedCode: string;
  isShared: boolean;
  selectedBlocks: string[];
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
  onToggleShare: (userId: number | null) => Promise<void>;
  onExecute: () => void;
  onConvert: (code: string) => void;
  onVerify: (code: string, model: string) => void;
  onModelSelect: (model: string) => void;
  onBlockSelect: (block: CodeBlock) => void;
  onRefreshComplete: () => void;
  onDeleteComplete: () => void;
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
}) => {
  return (
    <div className="right-panel">
      <div className="code-input-container">
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="코드 제목"
          className="code-title-input"
        />
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="코드 설명"
          className="code-description-input"
        />
      </div>
      
      <div className="button-container">
        <button className="reset-button" onClick={onReset}>
          초기화
        </button>
        <button className="save-button" onClick={() => onSave(currentUser?.id ?? null)}>
          저장
        </button>
        {selectedBlocks.length > 0 && currentUser && currentUser.id === selectedBlockUserId && (
          <button 
            className={`share-button ${isShared ? 'shared' : ''}`} 
            onClick={() => onToggleShare(currentUser?.id ?? null)}
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
          <button className="action-button" onClick={onExecute}>
            코드 실행
          </button>
          <button 
            className="action-button" 
            onClick={() => onConvert(currentCode)}
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
            onChange={(e) => onModelSelect(e.target.value)}
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
            onClick={() => onVerify(currentCode, selectedModel)}
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
          onSelectBlock={onBlockSelect}
          shouldRefresh={shouldRefresh}
          onRefreshComplete={onRefreshComplete}
          onDeleteComplete={onDeleteComplete}
          currentUser={currentUser ? {
            id: currentUser.id,
            email: currentUser.email,
            name: currentUser.name
          } : undefined}
        />
      </div>
    </div>
  );
}; 