import axiosClient from './axiosClient';

// User & role management — master admin only. Every endpoint here returns 403
// for a plain admin; the UI hides the screen to match.
export const getUsers = () => axiosClient.get('/users').then((r) => r.data);
export const createUser = (payload) => axiosClient.post('/users', payload).then((r) => r.data);
export const updateUser = (id, payload) => axiosClient.put(`/users/${id}`, payload).then((r) => r.data);
export const updateUserRole = (id, role) =>
  axiosClient.put(`/users/${id}/role`, { role }).then((r) => r.data);
export const setUserActive = (id, active) =>
  axiosClient.put(`/users/${id}/active`, { active }).then((r) => r.data);
export const resetUserPassword = (id, password) =>
  axiosClient.put(`/users/${id}/password`, { password }).then((r) => r.data);
export const deleteUser = (id) => axiosClient.delete(`/users/${id}`).then((r) => r.data);
