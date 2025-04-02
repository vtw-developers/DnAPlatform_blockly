import axios from 'axios';
import { CodeBlock, CreateCodeBlockDto } from '../types/CodeBlock';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

export const codeBlockApi = {
  // 코드 블록 생성
  createCodeBlock: async (data: CreateCodeBlockDto): Promise<CodeBlock> => {
    const response = await axios.post(`${API_BASE_URL}/code-blocks`, data);
    return response.data;
  },

  // 코드 블록 목록 조회
  getCodeBlocks: async (): Promise<CodeBlock[]> => {
    const response = await axios.get(`${API_BASE_URL}/code-blocks`);
    return response.data;
  },

  // 특정 코드 블록 조회
  getCodeBlock: async (id: number): Promise<CodeBlock> => {
    const response = await axios.get(`${API_BASE_URL}/code-blocks/${id}`);
    return response.data;
  },

  // 코드 블록 수정
  updateCodeBlock: async (id: number, data: Partial<CreateCodeBlockDto>): Promise<CodeBlock> => {
    const response = await axios.put(`${API_BASE_URL}/code-blocks/${id}`, data);
    return response.data;
  },

  // 코드 블록 삭제
  deleteCodeBlock: async (id: number): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/code-blocks/${id}`);
  }
}; 