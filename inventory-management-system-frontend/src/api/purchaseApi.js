import axiosClient from './axiosClient';

const get = (url, params) => axiosClient.get(url, { params }).then((r) => r.data);

export const getPurchases = (params) => get('/purchases', params);
export const searchPurchases = (params) => get('/purchases/search', params);
export const getPurchaseById = (id) => get(`/purchases/${id}`);
export const getPurchaseSummary = (id) => get(`/purchases/${id}/summary`);
export const createPurchase = (payload) => axiosClient.post('/purchases', payload).then((r) => r.data);
export const deletePurchase = (id) => axiosClient.delete(`/purchases/${id}`).then((r) => r.data);

export const uploadInvoice = (id, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return axiosClient.post(`/purchases/${id}/upload-invoice`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};
