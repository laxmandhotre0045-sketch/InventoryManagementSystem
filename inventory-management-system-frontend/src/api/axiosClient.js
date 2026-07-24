import axios from 'axios';

/**
 * API base URL resolution — no hardcoded hosts anywhere.
 *
 * 1. If VITE_API_BASE_URL is set at build time it wins (use only when the API
 *    lives on a different domain, e.g. https://api.sensovibe.com/api/v1).
 * 2. Otherwise fall back to a RELATIVE path. The browser then calls the same
 *    origin it loaded the app from, and nginx (container/VPS) or the Vite
 *    dev-server proxy (local) forwards /api/* to the backend.
 *
 * Result: one build runs on localhost and on the VPS with zero edits.
 */
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const axiosClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

let logoutHandler = null;
export const setLogoutHandler = (handler) => { logoutHandler = handler; };

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && logoutHandler) logoutHandler();
    return Promise.reject(error);
  }
);

export default axiosClient;
