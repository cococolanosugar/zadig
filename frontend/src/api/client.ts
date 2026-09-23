import axios, { type AxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios';
import { useAuthStore } from '../stores/auth';
import { feedback } from '../utils/feedback';

export interface ApiResponse<T = unknown> {
  code?: number;
  message?: string;
  description?: string;
  data?: T;
  [key: string]: unknown;
}

export interface ApiErrorResponse {
  code?: number;
  message?: string;
  description?: string;
  errorMsg?: string;
  resultCode?: number;
}

export const apiClient = axios.create({
  baseURL: '/',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    let token = useAuthStore.getState().token;
    if (!token) {
      try {
        const stored = localStorage.getItem('zadig_auth_store');
        if (stored) {
          const parsed = JSON.parse(stored);
          token = parsed?.state?.token;
        }
      } catch {
        // Ignore
      }
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipErrorHandler?: boolean;
  }
}

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Return data directly for convenience
    return response.data;
  },
  (error: AxiosError<ApiErrorResponse>) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const responseData = error.response?.data;
    const requestUrl = error.config?.url || '';

    // Handle 401 Unauthorized only for authenticated requests outside login/public key
    if (status === 401 && !requestUrl.includes('/rsaKey/') && !requestUrl.includes('/login')) {
      const hadToken = Boolean(error.config?.headers?.Authorization);
      if (hadToken) {
        useAuthStore.getState().logout();
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/signin')) {
          const redirect = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/signin?redirect=${redirect}`;
        }
      }
      return Promise.reject(error);
    }

    // Extract descriptive error message
    let errorMessage = error.message || '网络请求错误，请稍后重试';
    if (responseData) {
      if (responseData.description && responseData.message) {
        errorMessage = `${responseData.message}: ${responseData.description}`;
      } else if (responseData.errorMsg) {
        errorMessage = responseData.errorMsg;
      } else if (responseData.message) {
        errorMessage = responseData.message;
      } else if (responseData.description) {
        errorMessage = responseData.description;
      }
    }

    if (!error.config?.skipErrorHandler) {
      feedback.message.error(errorMessage);
    }
    return Promise.reject(error);
  }
);

export const http = {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return apiClient.get(url, config) as unknown as Promise<T>;
  },
  post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return apiClient.post(url, data, config) as unknown as Promise<T>;
  },
  put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return apiClient.put(url, data, config) as unknown as Promise<T>;
  },
  patch<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return apiClient.patch(url, data, config) as unknown as Promise<T>;
  },
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return apiClient.delete(url, config) as unknown as Promise<T>;
  },
};

export default http;
