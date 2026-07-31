import axiosClient from './axiosClient';

// Settings API — dynamic, DB-persisted. GET returns settings grouped by category.
export const getSettings = () => axiosClient.get('/settings').then((r) => r.data);
export const updateSettings = (settings) =>
  axiosClient.put('/settings', { settings }).then((r) => r.data);
