import axiosClient from './axiosClient';

// User & Role management (admin only).
export const getUsers = () => axiosClient.get('/users').then((r) => r.data);
export const createUser = (payload) => axiosClient.post('/users', payload).then((r) => r.data);
export const updateUserRole = (id, role) =>
  axiosClient.put(`/users/${id}/role`, { role }).then((r) => r.data);
export const deleteUser = (id) => axiosClient.delete(`/users/${id}`).then((r) => r.data);
