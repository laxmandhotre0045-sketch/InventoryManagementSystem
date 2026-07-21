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
