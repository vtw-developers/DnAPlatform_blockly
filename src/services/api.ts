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

class CodeBlockApi {
  private baseUrl = API_BASE_URL;

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
}

export const codeBlockApi = new CodeBlockApi(); 