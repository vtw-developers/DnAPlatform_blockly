import axios from 'axios';
import { getApiUrl } from './api';

const API_BASE_URL = getApiUrl();

// axios 인터셉터 설정
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 401 응답 처리
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // 로그인 시도가 아닐 때만 토큰 제거 및 리다이렉트
      if (!error.config.url.includes('/auth/login')) {
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export interface SignupData {
  email: string;
  password: string;
  name: string;
  organization?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  organization?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

class AuthApi {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/auth`;
    console.log('Using API URL:', API_BASE_URL);
  }

  async signup(data: SignupData): Promise<User> {
    try {
      const response = await axios.post(`${this.baseUrl}/register`, data);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.detail || '회원가입에 실패했습니다.');
      }
      throw error;
    }
  }

  async login(data: LoginData): Promise<AuthResponse> {
    try {
      const formData = new FormData();
      formData.append('username', data.email);
      formData.append('password', data.password);

      const response = await axios.post(`${this.baseUrl}/login`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });
      
      if (!response.data || !response.data.access_token) {
        throw new Error('Invalid login response');
      }
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.detail || '로그인에 실패했습니다.');
      }
      throw error;
    }
  }

  async getProfile(): Promise<User> {
    try {
      const response = await axios.get(`${this.baseUrl}/me`);
      console.log('Profile response:', response.data);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.detail || '프로필 조회에 실패했습니다.');
      }
      throw error;
    }
  }

  async updateProfile(data: {
    name: string;
    organization?: string;
    current_password?: string;
    new_password?: string;
  }): Promise<User> {
    try {
      const response = await axios.patch(`${this.baseUrl}/me`, data);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(error.response.data.detail || '프로필 수정에 실패했습니다.');
      }
      throw error;
    }
  }

  logout(): void {
    localStorage.removeItem('token');
    // axios 인스턴스의 기본 헤더에서 Authorization 제거
    delete axios.defaults.headers.common['Authorization'];
  }
}

export const authApi = new AuthApi(); 