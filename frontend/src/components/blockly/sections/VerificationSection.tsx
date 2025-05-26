import React from 'react';
import { Model } from '../types/model.types';
import '../styles/Sections.css';

interface VerificationSectionProps {
  selectedModel: Model | null;
  models: Model[];
  isLoadingModels: boolean;
  isVerifying: boolean;
  onModelSelect: (model: Model | null) => void;
  onVerify: () => void;
  disabled: boolean;
}

export const VerificationSection: React.FC<VerificationSectionProps> = ({
  selectedModel,
  models,
  isLoadingModels,
  isVerifying,
  onModelSelect,
  onVerify,
  disabled
}) => {
  return (
    <div className="verification-section">
      <h3 className="section-title">코드 검증</h3>
      <div className="verify-container">
        <select
          value={selectedModel?.name || ''}
          onChange={(e) => {
            const model = models.find(m => m.name === e.target.value) || null;
            onModelSelect(model);
          }}
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
          onClick={onVerify}
          disabled={disabled}
          className="verify-button"
        >
          {isVerifying ? '검증 중...' : '코드 검증'}
        </button>
      </div>
    </div>
  );
}; 