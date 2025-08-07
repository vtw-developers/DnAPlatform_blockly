import React, { useState, useEffect } from 'react';
import { Model } from '../types/model.types';
import '../styles/Sections.css';

interface VerificationSectionProps {
  selectedModel: Model | null;
  models: Model[];
  isLoadingModels: boolean;
  isVerifying: boolean;
  onModelSelect: (model: Model | null) => void;
  onVerify: (temperature: number) => void;
  disabled: boolean;
  temperature?: number;
  onTemperatureChange?: (temperature: number) => void;
}

export const VerificationSection: React.FC<VerificationSectionProps> = ({
  selectedModel,
  models,
  isLoadingModels,
  isVerifying,
  onModelSelect,
  onVerify,
  disabled,
  temperature: propTemperature,
  onTemperatureChange
}) => {
  // 로컬 temperature 상태 (prop으로 받거나 모델 기본값 사용)
  const [temperature, setTemperature] = useState<number>(0);

  // 모델이 변경될 때 temperature 기본값 설정
  useEffect(() => {
    if (selectedModel?.temp !== undefined) {
      const newTemp = propTemperature ?? selectedModel.temp;
      setTemperature(newTemp);
      onTemperatureChange?.(newTemp);
    }
  }, [selectedModel, propTemperature, onTemperatureChange]);

  const handleTemperatureChange = (value: number) => {
    setTemperature(value);
    onTemperatureChange?.(value);
  };
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
        
        {/* Temperature 설정 */}
        <div className="temperature-container">
          <label htmlFor="temperature-input" className="temperature-label">
            Temperature: 
            <span className="temperature-value">{temperature.toFixed(1)}</span>
          </label>
          <input
            id="temperature-input"
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
            className="temperature-slider"
            disabled={!selectedModel || disabled}
          />
          <div className="temperature-range">
            <span>0.0 (정확)</span>
            <span>2.0 (창의적)</span>
          </div>
        </div>

        <button
          onClick={() => onVerify(temperature)}
          disabled={disabled}
          className="verify-button"
        >
          {isVerifying ? '검증 중...' : '코드 검증'}
        </button>
      </div>
    </div>
  );
}; 