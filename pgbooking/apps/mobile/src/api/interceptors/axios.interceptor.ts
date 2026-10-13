import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'auth-storage' });

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost/api/v1';

// ─────────────────────────────────────────────
// Token Storage
// ─────────────────────────────────────────────

export const TokenStorage = {
  getAccessToken: () => storage.getString('access_token') ?? null,
  getRefreshToken: () => storage.getString('refresh_token') ?? null,
  setTokens: (access: string, refresh: string) => {
    storage.set('access_token', access);
    storage.set('refresh_token', refresh);
  },
  clearTokens: () => {
    storage.delete('access_token');
    storage.delete('refresh_token');
  },
};

// ─────────────────────────────────────────────
// Axios Instance
// ─────────────────────────────────────────────

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─────────────────────────────────────────────
// Request Interceptor — inject access token
// ─────────────────────────────────────────────

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = TokenStorage.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─────────────────────────────────────────────
// Response Interceptor — token refresh on 401
// ─────────────────────────────────────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = TokenStorage.getRefreshToken();
      if (!refreshToken) {
        TokenStorage.clearTokens();
        // Emit logout event for React Navigation to handle
        authEventEmitter.emit('logout');
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${BASE_URL}/auth/token/refresh`, {
          refresh_token: refreshToken,
        });
        const { access_token, refresh_token: newRefresh } = response.data.data;
        TokenStorage.setTokens(access_token, newRefresh);
        processQueue(null, access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        TokenStorage.clearTokens();
        authEventEmitter.emit('logout');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ─────────────────────────────────────────────
// Simple event emitter for auth events
// ─────────────────────────────────────────────

type AuthEvent = 'logout';
type AuthListener = () => void;

const authListeners = new Map<AuthEvent, AuthListener[]>();

export const authEventEmitter = {
  emit: (event: AuthEvent) => {
    authListeners.get(event)?.forEach((fn) => fn());
  },
  on: (event: AuthEvent, listener: AuthListener) => {
    if (!authListeners.has(event)) authListeners.set(event, []);
    authListeners.get(event)!.push(listener);
    return () => {
      const list = authListeners.get(event) ?? [];
      authListeners.set(event, list.filter((fn) => fn !== listener));
    };
  },
};
