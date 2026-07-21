import axios from 'axios';

const axiosClient = axios.create({
  baseURL: 'http://localhost:8081/api/v1',
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
