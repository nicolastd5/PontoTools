import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKENS_UPDATED_AT_KEY, saveAuthTokens } from './authTokenStorage';

export const BASE_URL = 'https://pontotools.shop';

const api = axios.create({
  baseURL: BASE_URL + '/api',
  timeout: 15000,
  headers: {
    // Identifica o cliente para o backend decidir onde enviar o refresh token
    'X-Client-Type': 'mobile',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthRoute = original.url?.includes('/auth/login') || original.url?.includes('/auth/refresh');
    if (error.response?.status === 401 && !original._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }
      original._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('Sem refresh token');
        const { data } = await axios.post(
          `${BASE_URL}/api/auth/refresh`,
          { refreshToken },
          { headers: { 'X-Client-Type': 'mobile' } },
        );
        await saveAuthTokens(data.accessToken, data.refreshToken ?? null);
        processQueue(null, data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch (err) {
        processQueue(err, null);
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', AUTH_TOKENS_UPDATED_AT_KEY, 'user']);
        throw err;
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default api;
