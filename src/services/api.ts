import axios, { AxiosError } from 'axios';
import { CodeBlock, CreateCodeBlockDto } from '../types/CodeBlock';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const handleApiError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    if (axiosError.response) {
      throw new Error(`API 오류: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`);
    } else if (axiosError.request) {
      throw new Error('서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.');
    }
  }
  throw new Error('알 수 없는 오류가 발생했습니다.');
};

export const codeBlockApi = {
  // 코드 블록 생성
  createCodeBlock: async (data: CreateCodeBlockDto): Promise<CodeBlock> => {
    try {
      const response = await axiosInstance.post('/code-blocks', data);
      return response.data;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  },

  // 코드 블록 목록 조회
  getCodeBlocks: async (): Promise<CodeBlock[]> => {
    try {
      const response = await axiosInstance.get('/code-blocks');
      return response.data;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  },

  // 특정 코드 블록 조회
  getCodeBlock: async (id: number): Promise<CodeBlock> => {
    try {
      const response = await axiosInstance.get(`/code-blocks/${id}`);
      return response.data;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  },

  // 코드 블록 수정
  updateCodeBlock: async (id: number, data: Partial<CreateCodeBlockDto>): Promise<CodeBlock> => {
    try {
      const response = await axiosInstance.put(`/code-blocks/${id}`, data);
      return response.data;
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  },

  // 코드 블록 삭제
  deleteCodeBlock: async (id: number): Promise<void> => {
    try {
      await axiosInstance.delete(`/code-blocks/${id}`);
    } catch (error) {
      handleApiError(error);
      throw error;
    }
  }
}; 