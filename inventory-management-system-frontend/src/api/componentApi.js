import axiosClient from './axiosClient';

const get = (url, params) => axiosClient.get(url, { params }).then((r) => r.data);

export const getComponents = (params) => get('/components', params);
export const searchComponents = (params) => get('/components/search', params);
export const getLowStockComponents = () => get('/components/low-stock');
export const getComponentById = (id) => get(`/components/${id}`);
export const createComponent = (payload) => axiosClient.post('/components', payload).then((r) => r.data);
export const updateComponent = (id, payload) => axiosClient.put(`/components/${id}`, payload).then((r) => r.data);
export const deleteComponent = (id) => axiosClient.delete(`/components/${id}`).then((r) => r.data);
export const restoreComponent = (id) => axiosClient.post(`/components/${id}/restore`).then((r) => r.data);
