// Instância Axios com interceptor de refresh automático de token
import axios from 'axios';

const api = axios.create({
  baseURL:        '/api',
  withCredentials: true, // envia cookie do refresh token automaticamente
  headers: {
    // Identifica o cliente para o backend manter o refresh token apenas em cookie HttpOnly
    'X-Client-Type': 'web',
  },
});

// Injeta o access token em toda requisição
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepta 401 e tenta renovar o access token automaticamente
let isRefreshing = false;
let failedQueue  = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else       resolve(token);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Não intercepta 401 de rotas de autenticação (login/refresh)
    const isAuthRoute = originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh');

    // Evita loop: só tenta refresh uma vez por request
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        // Enfileira requisições que chegarem enquanto o refresh está em andamento
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post('/api/auth/refresh', {}, {
          withCredentials: true,
          headers: { 'X-Client-Type': 'web' },
        });
        const newToken = data.accessToken;

        localStorage.setItem('accessToken', newToken);
        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Refresh falhou — redireciona para login
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
