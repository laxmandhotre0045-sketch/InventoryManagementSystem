import axiosClient from './axiosClient';

export const stockIn = (payload) => axiosClient.post('/inventory/stock-in', payload).then((r) => r.data);
export const stockOut = (payload) => axiosClient.post('/inventory/stock-out', payload).then((r) => r.data);
export const getTransactionHistory = (params) => axiosClient.get('/inventory/history', { params }).then((r) => r.data);
export const getTransactionById = (id) => axiosClient.get(`/inventory/${id}`).then((r) => r.data);
