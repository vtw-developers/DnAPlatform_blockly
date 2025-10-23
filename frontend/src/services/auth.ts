import axios from 'axios';
import { getApiUrl } from './api';
import { tokenManager } from './api';

const API_BASE_URL = getApiUrl();

// axios 인터셉터 설정
axios.interceptors.request.use(
  (config) => {
    const token = tokenManager.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// auth.ts에서는 별도의 401 처리 인터셉터를 제거
// api.ts의 인터셉터에서 토큰 갱신 및 리다이렉트를 처리

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
  refresh_token: string;
  token_type: string;
  expires_in: number;
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
      
      // 토큰 매니저를 사용하여 토큰 저장
      const { access_token, refresh_token } = response.data;
      tokenManager.setTokens(access_token, refresh_token);
      
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
    tokenManager.clearTokens();
    // axios 인스턴스의 기본 헤더에서 Authorization 제거
    delete axios.defaults.headers.common['Authorization'];
  }
}

export const authApi = new AuthApi(); 