import axios from 'axios';

/**
 * API base URL — configured via the VITE_API_URL environment variable
 * (see .env). No backend host is hardcoded.
 *
 * 1. When VITE_API_URL is an absolute URL it wins — use this for a
 *    forwarded/tunnel backend on a different origin, e.g.
 *    VITE_API_URL=https://your-backend.ngrok-free.app/api/v1
 * 2. The default is the RELATIVE path "/api/v1", so the browser calls the
 *    same origin it loaded from and the request is proxied to the backend by
 *    the Vite dev server (local) or nginx (Docker/VPS) — no CORS needed.
 *
 * The `|| '/api/v1'` keeps the app working even if the variable is unset.
 */
const baseURL = import.meta.env.VITE_API_URL || '/api/v1';

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
