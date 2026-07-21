import axiosClient from './axiosClient';

export const login = (email, password) =>
  axiosClient.post('/auth/login', { email, password }).then((r) => r.data);

export const register = (email, password) =>
  axiosClient.post('/auth/register', { email, password }).then((r) => r.data);
