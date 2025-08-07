import { useState, useEffect } from 'react';
import { codeBlockApi } from '../../../services/api';
import { Model } from '../types/model.types';

export interface UseModelsReturn {
  models: Model[];
  selectedModel: Model | null;
  setSelectedModel: (model: Model | null) => void;
  isLoadingModels: boolean;
}

export const useModels = (): UseModelsReturn => {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      setIsLoadingModels(true);
      try {
        const response = await codeBlockApi.getModels();
        setModels(response.map(model => ({
          ...model,
          type: model.type as 'openai' | 'ollama',
          isAvailable: true,
          temp: model.temp || 0 // 모델의 기본 temperature 값 (기본값: 0)
        })));
        if (response.length > 0) {
          setSelectedModel(response[0]);
        }
      } catch (error) {
        console.error('Error loading models:', error);
      } finally {
        setIsLoadingModels(false);
      }
    };

    loadModels();
  }, []);

  return {
    models,
    selectedModel,
    setSelectedModel,
    isLoadingModels
  };
}; 