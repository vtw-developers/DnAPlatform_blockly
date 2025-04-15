import { ModelInfo } from '../../../services/api';

export interface BlocklyWorkspaceProps {
  onCodeGenerate: (code: string) => void;
}

export interface ExecutionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  status: string;
  result: {
    output?: string;
    error?: string;
  } | null;
}

export interface ExecutionResult {
  output?: string;
  error?: string;
}

export interface VerificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  status: string;
  result: {
    dag_run_id?: string;
    error?: string;
    verificationResult?: {
      result_code?: string;
      message?: string;
    };
  } | null;
  elapsedTime: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface NaturalLanguagePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBlock: (blockXml: string) => void;
}

export interface LLMModel {
  name: string;
  type: 'ollama' | 'openai';
  modified_at?: string;
  size?: number;
  description?: string;
}

export interface ConversionPopupProps {
  isOpen: boolean;
  onClose: () => void;
  status: string;
  dagRunId: string | null;
  error: string | null;
  isConverting: boolean;
  elapsedTime: number;
} 