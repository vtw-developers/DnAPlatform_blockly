import { CodeBlock, CreateCodeBlockDto } from '../types/CodeBlock';
import axios from 'axios';

// API URL 설정
const getApiUrl = () => {
  const hostname = window.location.hostname;
  
  // localhost 환경
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return import.meta.env.VITE_LOCAL_API_URL || '/api';
  }
  
  // 내부 IP 환경 (192.168.0.x)
  if (hostname.startsWith('192.168.')) {
    return import.meta.env.VITE_INTERNAL_API_URL;
  }
  
  // 기본값은 공인 IP 환경
  return import.meta.env.VITE_PUBLIC_API_URL || import.meta.env.VITE_API_URL;
};

const API_BASE_URL = getApiUrl();
console.log('Using API URL:', API_BASE_URL);

// 디버깅을 위한 로그 추가
console.log('API_BASE_URL:', API_BASE_URL);

// 개발 환경에서는 상대경로 사용, 프로덕션에서는 전체 URL 사용
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocalhost ? '/api' : API_BASE_URL || 'http://121.65.128.115:8000/api';
console.log('Using API URL:', API_URL);

export interface CodeBlocksResponse {
  blocks: CodeBlock[];
  total: number;
}

interface CodeExecuteResponse {
  output: string;
  error: string;
}

interface CodeVerifyResponse {
  dag_run_id: string;
}

interface CodeVerifyRequest {
  code: string;
  model_name?: string;
}

export interface ModelInfo {
  name: string;
  type: 'ollama' | 'openai';
  size?: number;
  digest?: string;
  modified_at?: string;
  description?: string;
}

interface ModelsResponse {
  models: ModelInfo[];
}

export interface VerificationResult {
  result?: {
    elapsed_time?: number;
    result_code?: string;
    message?: string;
  };
  error?: string;
  status?: 'RUNNING' | 'SUCCESS' | 'ERROR';
}

interface OllamaResponse {
  response: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface LLMModel {
  name: string;
  type: 'ollama' | 'openai';
  modified_at?: string;
  size?: number;
  digest?: string;
  description?: string;
}

export class CodeBlockApi {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  async getCodeBlocks(page: number = 1, limit: number = 10): Promise<CodeBlocksResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/code-blocks?page=${page}&limit=${limit}`);
      if (!response.ok) {
        throw new Error('코드 블록을 가져오는데 실패했습니다.');
      }
      return await response.json();
    } catch (error) {
      console.error('코드 블록 가져오기 오류:', error);
      return { blocks: [], total: 0 };
    }
  }

  async createCodeBlock(data: CreateCodeBlockDto): Promise<CodeBlock> {
    const response = await fetch(`${this.baseUrl}/code-blocks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('코드 블록 생성에 실패했습니다.');
    }

    return await response.json();
  }

  async updateCodeBlock(id: number, data: CreateCodeBlockDto): Promise<CodeBlock> {
    const response = await fetch(`${this.baseUrl}/code-blocks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('코드 블록 수정에 실패했습니다.');
    }

    return await response.json();
  }

  async deleteCodeBlocks(ids: number[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/code-blocks`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids }),
    });

    if (!response.ok) {
      throw new Error('코드 블록 삭제에 실패했습니다.');
    }
  }

  async executeCode(code: string): Promise<CodeExecuteResponse> {
    const response = await fetch(`${this.baseUrl}/execute-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error('코드 실행에 실패했습니다.');
    }

    return await response.json();
  }

  async verifyCode(code: string, model_name: string): Promise<{ dag_run_id: string }> {
    console.log(`Requesting verification via backend for model: ${model_name}`);
    try {
      // Call the new backend endpoint instead of Airflow directly
      const response = await axios.post<{ dag_run_id: string }>(
        `${this.baseUrl}/code/verify`, // <<< New backend endpoint
        {
          // Send code and model name in the request body
          code: code,
          model_name: model_name
        },
        {
          headers: {
            'Content-Type': 'application/json'
            // No Airflow Authorization header needed here; backend handles it
          }
        }
      );

      console.log('Verification requested via backend, response:', response.data);
      // Expecting backend to return { dag_run_id: string }
      if (!response.data || !response.data.dag_run_id) {
         throw new Error('백엔드 응답에서 dag_run_id를 찾을 수 없습니다.');
      }
      return response.data;

    } catch (error) {
      console.error('백엔드를 통한 코드 검증 요청 중 오류:', error);
       if (axios.isAxiosError(error) && error.response) {
         // Provide more specific error from backend if available
         throw new Error(`코드 검증 요청 실패 (${error.response.status}): ${error.response.data?.detail || error.message}`);
       } else if (error instanceof Error) {
         throw new Error(`코드 검증 요청 실패: ${error.message}`);
       } else {
         throw new Error('코드 검증 요청 중 알 수 없는 오류 발생');
       }
    }
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`);
      if (!response.ok) {
        throw new Error('모델 목록을 가져오는데 실패했습니다.');
      }
      const data = await response.json();
      return data.models;
    } catch (error) {
      console.error('모델 목록 가져오기 오류:', error);
      return [];
    }
  }

  async getVerificationResult(dagRunId: string): Promise<VerificationResult> {
    try {
      const response = await fetch(
        `${this.baseUrl}/proxy/airflow/api/v1/dags/equiv_task/dagRuns/${dagRunId}/taskInstances/get_result/xcomEntries/return_value`,
        {
          method: 'GET',
          headers: {
            'Authorization': 'Basic YWRtaW46dnR3MjEwMzAy',
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return { status: 'RUNNING' };
        }
        throw new Error(`검증 결과 조회 실패: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('검증 결과 데이터:', data);

      // 응답 데이터 구조 처리
      const result = {
        elapsed_time: 0, // 실제 소요 시간은 나중에 추가
        result_code: data.value, // 전체 검증 결과를 표시
        message: '코드 검증이 완료되었습니다.'
      };

      return { result, status: 'SUCCESS' };
    } catch (error) {
      console.error('검증 결과 조회 중 상세 오류:', error);
      if (error instanceof Error && error.message.includes('404')) {
        return { status: 'RUNNING' };
      }
      if (error instanceof Error) {
        return { error: error.message, status: 'ERROR' };
      }
      return { error: '알 수 없는 오류가 발생했습니다.', status: 'ERROR' };
    }
  }

  async getAvailableModels(): Promise<LLMModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`);
      if (!response.ok) {
        console.error('모델 목록을 가져오는데 실패했습니다:', response.status);
        return [];
      }
      const data = await response.json();
      return data.models;
    } catch (error) {
      console.error('모델 목록 가져오기 오류:', error);
      return [];
    }
  }

  async generateBlockCode(description: string, model: LLMModel): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/generate-block`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description,
          model_name: model.name,
          model_type: model.type
        }),
      });

      if (!response.ok) {
        throw new Error('블록 생성에 실패했습니다.');
      }

      const data = await response.json();
      return data.xml;
    } catch (error) {
      console.error('블록 생성 중 오류:', error);
      throw error;
    }
  }

  async convertPythonToBlockly(pythonCode: string, modelName: string, modelType: string = 'ollama'): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/python-to-blockly`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          python_code: pythonCode,
          model_name: modelName,
          model_type: modelType
        }),
      });

      if (!response.ok) {
        throw new Error('Python 코드를 Blockly로 변환하는데 실패했습니다.');
      }

      const data = await response.json();
      return data.xml;
    } catch (error) {
      console.error('Python to Blockly 변환 중 오류:', error);
      throw error;
    }
  }
}

export const codeBlockApi = new CodeBlockApi(); 