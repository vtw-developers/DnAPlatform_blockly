import { CodeBlock, CreateCodeBlockDto } from '../types/CodeBlock';

// 개발 환경에서는 localhost:8000을 사용
const API_BASE_URL = 'http://localhost:8000/api';

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
  size: number;
  digest: string;
  modified_at: string;
}

interface ModelsResponse {
  models: ModelInfo[];
}

class CodeBlockApi {
  private baseUrl = API_BASE_URL;
  private verifyUrl = `${API_BASE_URL}/proxy/airflow/api/v1/dags/equiv_task/dagRuns`;
  private verifyAuth = 'YWRtaW46dnR3MjEwMzAy'; // 하드코딩된 Base64 인코딩 값

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

  async verifyCode(code: string, model_name: string = "qwen2.5-coder:32b"): Promise<{ dag_run_id: string }> {
    try {
      const response = await fetch(this.verifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          model_name
        })
      });

      if (!response.ok) {
        throw new Error('코드 검증에 실패했습니다.');
      }

      return await response.json();
    } catch (error) {
      console.error('코드 검증 중 오류:', error);
      throw error;
    }
  }

  async getModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`);
      if (!response.ok) {
        throw new Error('모델 목록을 가져오는데 실패했습니다.');
      }
      const data: ModelsResponse = await response.json();
      return data.models;
    } catch (error) {
      console.error('모델 목록 가져오기 오류:', error);
      return [];
    }
  }
}

export const codeBlockApi = new CodeBlockApi(); 