export interface Model {
  name: string;
  type: 'openai' | 'ollama';
  description?: string;
  isAvailable?: boolean;
  temp?: number; // 모델의 기본 temperature 값
} 