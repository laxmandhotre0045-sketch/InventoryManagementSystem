import axiosClient from './axiosClient';

const get = (url, params) => axiosClient.get(url, { params }).then((r) => r.data);

export const getComponentCategories = () => get('/component-categories');
export const getComponentCategoryById = (id) => get(`/component-categories/${id}`);
export const createComponentCategory = (payload) =>
  axiosClient.post('/component-categories', payload).then((r) => r.data);
export const updateComponentCategory = (id, payload) =>
  axiosClient.put(`/component-categories/${id}`, payload).then((r) => r.data);
export const deleteComponentCategory = (id) =>
  axiosClient.delete(`/component-categories/${id}`).then((r) => r.data);
