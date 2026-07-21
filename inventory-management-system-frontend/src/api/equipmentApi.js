import axiosClient from './axiosClient';

const get = (url, params) => axiosClient.get(url, { params }).then((r) => r.data);

export const getEquipment = (params) => get('/equipment', params);
export const searchEquipment = (params) => get('/equipment/search', params);
export const getEquipmentById = (id) => get(`/equipment/${id}`);
export const createEquipment = (payload) => axiosClient.post('/equipment', payload).then((r) => r.data);
export const updateEquipment = (id, payload) => axiosClient.put(`/equipment/${id}`, payload).then((r) => r.data);
export const deleteEquipment = (id) => axiosClient.delete(`/equipment/${id}`).then((r) => r.data);
