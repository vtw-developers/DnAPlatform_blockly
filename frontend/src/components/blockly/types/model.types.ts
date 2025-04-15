export interface Model {
  name: string;
  type: 'openai' | 'ollama';
  description?: string;
  isAvailable?: boolean;
} 