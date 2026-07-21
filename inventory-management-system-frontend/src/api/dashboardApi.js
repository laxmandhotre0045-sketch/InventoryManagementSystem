import axiosClient from './axiosClient';

export const getDashboardSummary = () => axiosClient.get('/dashboard/summary').then((r) => r.data);
export const getLowStock = () => axiosClient.get('/dashboard/low-stock').then((r) => r.data);
export const getRecentPurchases = (limit = 5) => axiosClient.get('/dashboard/recent-purchases', { params: { limit } }).then((r) => r.data);
export const getRecentTransactions = (limit = 5) => axiosClient.get('/dashboard/recent-transactions', { params: { limit } }).then((r) => r.data);
export const getProjectSummary = () => axiosClient.get('/dashboard/project-summary').then((r) => r.data);
