import { useState, useEffect } from 'react';
import { codeBlockApi } from '../../../services/api';
import { Model } from '../types/model.types';

export interface UseModelsReturn {
  models: Model[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  isLoadingModels: boolean;
}

export const useModels = (): UseModelsReturn => {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      setIsLoadingModels(true);
      try {
        const response = await codeBlockApi.getModels();
        setModels(response.map(model => ({
          ...model,
          type: model.type as 'openai' | 'ollama',
          isAvailable: true
        })));
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