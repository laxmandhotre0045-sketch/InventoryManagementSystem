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

// Move a component that is really equipment into the Equipment register (one record per
// unit; the component is archived, not deleted). dryRun=true previews without saving.
export const moveComponentToEquipment = (id, payload = {}, dryRun = false) =>
  axiosClient.post(`/components/${id}/move-to-equipment`, payload, { params: { dryRun } }).then((r) => r.data);

// Re-file components under another Category › Type › Value. Empty fields keep each
// component's own value; only these three fields change.
export const relocateComponents = (payload) =>
  axiosClient.post('/components/relocate', payload).then((r) => r.data);
