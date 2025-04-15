import { useState, useEffect } from 'react';
import { codeBlockApi } from '../../../services/api';

export interface Model {
  name: string;
  type: string;
  description?: string;
}

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
        setModels(response);
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