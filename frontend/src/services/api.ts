import { CodeBlock, CreateCodeBlockDto } from '../types/CodeBlock';
import axios from 'axios';

// API URL 설정
export const getApiUrl = () => {
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
const API_URL = isLocalhost ? import.meta.env.VITE_LOCAL_API_URL || '/api' : API_BASE_URL;
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
  temp?: number; // 모델의 기본 temperature 값
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

interface DagRunTriggerResponse {
  dag_run_id: string;
}

interface DagStatusResponse {
    dag_run_id: string;
    state: 'running' | 'success' | 'failed' | 'error' | 'unknown' | 'queued';
    error?: string;
}

interface XComResponse {
    value?: string;
    error?: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  organization: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
}

export interface UserUpdateData {
  name?: string;
  organization?: string;
  role?: 'admin' | 'user';
  is_active?: boolean;
}

export class CodeBlockApi {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  private getHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  }

  async getCodeBlocks(page: number = 1, limit: number = 10, filterType: 'my' | 'shared' = 'my'): Promise<CodeBlocksResponse> {
    try {
      const response = await axios.get<CodeBlocksResponse>(`${this.baseUrl}/code-blocks`, {
        headers: this.getHeaders(),
        params: {
          page,
          limit,
          filter_type: filterType
        }
      });
      return response.data;
    } catch (error) {
      console.error('코드 블록 조회 중 오류 발생:', error);
      throw error;
    }
  }

  async createCodeBlock(data: CreateCodeBlockDto): Promise<CodeBlock> {
    const response = await fetch(`${this.baseUrl}/code-blocks`, {
      method: 'POST',
      headers: this.getHeaders(),
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
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('코드 블록 수정에 실패했습니다.');
    }

    return await response.json();
  }

  async deleteCodeBlocks(ids: number[]): Promise<void> {
    try {
      await axios.delete(`${this.baseUrl}/code-blocks`, {
        headers: this.getHeaders(),
        data: { ids }
      });
    } catch (error) {
      console.error('코드 블록 삭제 실패:', error);
      throw error;
    }
  }

  async toggleShareCodeBlock(id: number): Promise<CodeBlock> {
    try {
      const response = await axios.patch(
        `${this.baseUrl}/code-blocks/${id}/share`,
        {},
        {
          headers: this.getHeaders()
        }
      );
      return response.data;
    } catch (error) {
      console.error('코드 블록 공유 상태 변경 실패:', error);
      throw error;
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

  async convertCode(code: string, modelName: string, snartContent: string = ''): Promise<DagRunTriggerResponse> {
    console.log(`Requesting conversion via backend with snart content length: ${snartContent.length}`);
    try {
      const response = await axios.post<DagRunTriggerResponse>(
        `${this.baseUrl}/code/convert`,
        {
          code: code,
          snart_content: snartContent
        }
      );
      return response.data;
    } catch (error) {
      console.error('Code conversion error:', error);
      throw error;
    }
  }

  async getConversionStatus(runId: string): Promise<DagStatusResponse> {
     console.log(`Checking conversion status via backend for runId: ${runId}`);
    try {
      const response = await axios.get<DagStatusResponse>(
        `${this.baseUrl}/code/convert/status/${runId}`
      );
      console.log('Conversion status from backend:', response.data);
      // Ensure a valid state is returned, default to unknown if not present
      return {
          ...response.data,
          state: response.data?.state || 'unknown'
      };
    } catch (error) {
      console.error(`백엔드를 통한 상태 조회 중 오류 (${runId}):`, error);
      // Return an error state compatible with DagStatusResponse
       return {
          dag_run_id: runId,
          state: 'error',
          error: '백엔드 상태 조회 실패' // Simplified error message
       };
    }
  }

  async getConversionResult(runId: string): Promise<XComResponse> {
     console.log(`Getting conversion result via backend for runId: ${runId}`);
    try {
      const response = await axios.get<XComResponse>(
        `${this.baseUrl}/code/convert/result/${runId}`
      );
      console.log('Conversion result from backend:', response.data);
      return response.data;
    } catch (error) {
      console.error(`백엔드를 통한 결과 조회 중 오류 (${runId}):`, error);
      return {
          error: '백엔드 결과 조회 실패' // Simplified error message
      };
    }
  }

  // 변환규칙 생성을 위한 rule_task DAG 호출
  async createTranslationRule(sourceCodeId: number, sourceCodeTitle: string): Promise<DagRunTriggerResponse> {
    console.log(`Requesting translation rule creation for source code: ${sourceCodeId} - ${sourceCodeTitle}`);
    try {
      const response = await axios.post<DagRunTriggerResponse>(
        `${this.baseUrl}/airflow/rule-task`,
        {
          source_code_id: sourceCodeId,
          source_code_title: sourceCodeTitle
        }
      );
      console.log('Translation rule creation requested via backend, response:', response.data);
      return response.data;
    } catch (error) {
      console.error('변환규칙 생성 요청 중 오류:', error);
      throw error;
    }
  }

  async verifyCode(code: string, model_name: string, model_type: string, temperature: number = 0): Promise<{ dag_run_id: string }> {
    console.log(`Requesting verification via backend for model: ${model_name}, type: ${model_type}, temperature: ${temperature}`);
    try {
      const response = await axios.post<{ dag_run_id: string }>(
        `${this.baseUrl}/code/verify`, 
        {
          code: code,
          model_name: model_name,
          model_type: model_type,
          temperature: temperature
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('Verification requested via backend, response:', response.data);
      if (!response.data || !response.data.dag_run_id) {
         throw new Error('백엔드 응답에서 dag_run_id를 찾을 수 없습니다.');
      }
      return response.data;
    } catch (error) {
      console.error('백엔드를 통한 코드 검증 요청 중 오류:', error);
       if (axios.isAxiosError(error) && error.response) {
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
      const data: ModelsResponse = await response.json();
      return data.models;
    } catch (error) {
      console.error('모델 목록 가져오기 오류:', error);
      throw error;
    }
  }

  async getVerificationResult(dagRunId: string): Promise<XComResponse> {
    console.log(`Getting verification result via backend for runId: ${dagRunId}`);
    try {
      const response = await axios.get<XComResponse>(
        `${this.baseUrl}/code/verify/result/${dagRunId}` // <<< Call backend result endpoint
      );
      console.log('Verification result from backend:', response.data);
      // Directly return the backend response which matches XComResponse
      return response.data; 
    } catch (error) {
      console.error(`백엔드를 통한 검증 결과 조회 중 오류 (${dagRunId}):`, error);
      // Return an error structure matching XComResponse
      return {
          error: '백엔드 결과 조회 실패' 
      };
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

  async getDagRunStatus(runId: string): Promise<DagStatusResponse> {
    console.log(`Checking verification status via backend for runId: ${runId}`);
    try {
      const response = await axios.get<DagStatusResponse>(
        `${this.baseUrl}/code/verify/status/${runId}`
      );
      console.log('Verification status from backend:', response.data);
      return {
        ...response.data,
        state: response.data?.state || 'unknown'
      };
    } catch (error) {
      console.error('백엔드를 통한 검증 상태 조회 중 오류:', error);
      return {
        dag_run_id: runId,
        state: 'error',
        error: '백엔드 상태 조회 실패'
      };
    }
  }

  async deployService(code: string, port: number, deployType: 'python' | 'graalvm' = 'python'): Promise<{ success: boolean; logs: string[] }> {
    try {
      console.log('Deploying service to:', `${this.baseUrl}/deploy`);
      const response = await axios.post(
        `${this.baseUrl}/deploy`,
        { code, port, deployType },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('서비스 배포 중 오류:', error);
      throw error;
    }
  }

  async getContainerStatus(port: number) {
    const response = await fetch(`${this.baseUrl}/container/status?port=${port}`);
    if (!response.ok) {
      throw new Error('컨테이너 상태 조회에 실패했습니다.');
    }
    return await response.json();
  }

  async startContainer(port: number) {
    const response = await fetch(`${this.baseUrl}/container/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port })
    });
    if (!response.ok) {
      throw new Error('컨테이너 시작에 실패했습니다.');
    }
    return await response.json();
  }

  async stopContainer(port: number) {
    const url = `${this.baseUrl}/container/stop`;
    const requestBody = { port: port };
    console.log('Stopping container with URL:', url);
    console.log('Request body:', requestBody);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Container stop failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error('컨테이너 중지에 실패했습니다.');
    }
    return await response.json();
  }

  async removeContainer(port: number) {
    const url = `${this.baseUrl}/container/remove`;
    const requestBody = { port: port };
    console.log('Removing container with URL:', url);
    console.log('Request body:', requestBody);
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
      throw new Error('컨테이너 삭제에 실패했습니다.');
    }
    return await response.json();
  }

  async saveConvertedCode(
    sourceCodeId: number,
    sourceCodeTitle: string,
    description: string,
    convertedCode: string
  ): Promise<any> {
    const response = await axios.post(
      `${this.baseUrl}/code/converted`,
      {
        source_code_id: sourceCodeId,
        description,
        converted_code: convertedCode
      }
    );
    return response.data;
  }

  async updateConvertedCode(
    id: number,
    sourceCodeId: number,
    description: string,
    convertedCode: string
  ): Promise<any> {
    const response = await axios.put(`${this.baseUrl}/code/converted/${id}`, {
      source_code_id: sourceCodeId,
      description,
      converted_code: convertedCode
    });
    return response.data;
  }

  async getConvertedCodes(sourceCodeId: number): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/code/converted/${sourceCodeId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching converted codes:', error);
      throw error;
    }
  }

  async testService(port: number) {
    try {
      const response = await axios.get(`${this.baseUrl}/test-service`, {
        params: { port },
        headers: this.getHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('서비스 테스트 중 오류:', error);
      throw error;
    }
  }

  async deleteConvertedCodes(ids: number[]): Promise<void> {
    try {
      await axios.delete(`${this.baseUrl}/code/converted`, {
        headers: this.getHeaders(),
        data: { ids }
      });
    } catch (error) {
      console.error('변환 코드 삭제 중 오류 발생:', error);
      throw error;
    }
  }
}

export const codeBlockApi = new CodeBlockApi();

export class UserManagementApi {
  private static instance: UserManagementApi;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = `${API_URL}/auth`;
  }

  public static getInstance(): UserManagementApi {
    if (!UserManagementApi.instance) {
      UserManagementApi.instance = new UserManagementApi();
    }
    return UserManagementApi.instance;
  }

  private getHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
  }

  private getRequestConfig() {
    return {
      headers: this.getHeaders(),
      withCredentials: true
    };
  }

  async getUsers(skip: number, limit: number): Promise<UserListResponse> {
    try {
      console.log('Fetching users with params:', { skip, limit });
      const response = await axios.get(
        `${this.baseUrl}/users`,
        {
          ...this.getRequestConfig(),
          params: { skip, limit }
        }
      );
      return response.data;
    } catch (error) {
      console.error('사용자 목록 조회 실패:', error);
      throw error;
    }
  }

  async updateUser(userId: number, data: UserUpdateData): Promise<User> {
    try {
      const response = await axios.patch(
        `${this.baseUrl}/users/${userId}`,
        data,
        this.getRequestConfig()
      );
      return response.data;
    } catch (error) {
      console.error('사용자 정보 수정 실패:', error);
      throw error;
    }
  }

  async deleteUser(userId: number): Promise<void> {
    try {
      await axios.delete(
        `${this.baseUrl}/users/${userId}`,
        this.getRequestConfig()
      );
    } catch (error) {
      console.error('사용자 삭제 실패:', error);
      throw error;
    }
  }
}

export const userManagementApi = UserManagementApi.getInstance();