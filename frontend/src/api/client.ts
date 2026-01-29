import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    // eslint-disable-next-line no-param-reassign
    config.headers = config.headers ?? {};
    // eslint-disable-next-line no-param-reassign
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

