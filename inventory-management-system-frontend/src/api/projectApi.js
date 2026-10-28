import axiosClient from './axiosClient';

const get = (url, params) => axiosClient.get(url, { params }).then((r) => r.data);

export const getProjects = (params) => get('/projects', params);
export const searchProjects = (params) => get('/projects/search', params);
export const getProjectById = (id) => get(`/projects/${id}`);
export const getProjectUsageSummary = (projectId) => get(`/projects/${projectId}/usage-summary`);
export const createProject = (payload) => axiosClient.post('/projects', payload).then((r) => r.data);
export const updateProject = (id, payload) => axiosClient.put(`/projects/${id}`, payload).then((r) => r.data);
export const deleteProject = (id) => axiosClient.delete(`/projects/${id}`).then((r) => r.data);
export const recordProjectUsage = (payload) => axiosClient.post('/project-usage', payload).then((r) => r.data);
export const getProjectUsagesByProject = (projectId, params) => get(`/project-usage/project/${projectId}`, params);

// ---- Project folder: the components bought or set aside for one project ----
/** Folder + cost summary; keyword searches only this project's components. */
export const getProjectFolder = (projectId, keyword) =>
  get(`/projects/${projectId}/components`, keyword ? { keyword } : undefined);
/** payload: { componentId, quantity, unitPrice?, mode: 'BOUGHT' | 'RESERVED', notes? } */
export const addProjectComponent = (projectId, payload) =>
  axiosClient.post(`/projects/${projectId}/components`, payload).then((r) => r.data);
/** Takes one entry out of the folder; stock is unchanged (units return to general stock). */
export const releaseProjectEntry = (projectId, entryId) =>
  axiosClient.delete(`/projects/${projectId}/components/entries/${entryId}`).then((r) => r.data);
/** payload: { componentId, toProjectId, quantity, notes? } — moves units to another project's folder; stock unchanged. */
export const transferProjectComponent = (projectId, payload) =>
  axiosClient.post(`/projects/${projectId}/components/transfer`, payload).then((r) => r.data);
export const getProjectPurchases =(projectId) => get(`/projects/${projectId}/purchases`);
