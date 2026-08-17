import axiosClient from './axiosClient';

const get = (url, params) => axiosClient.get(url, { params }).then((r) => r.data);

/**
 * Settings shows everyone, including deactivated members — it has to, in order to
 * reactivate them. The project dropdowns pass activeOnly so a retired colleague stops
 * being offered without disappearing from the projects they already worked on.
 */
export const getTeamMembers = (params) => get('/team-members', params);
export const getActiveTeamMembers = () => get('/team-members', { activeOnly: true });
export const getTeamMemberById = (id) => get(`/team-members/${id}`);
export const createTeamMember = (payload) =>
  axiosClient.post('/team-members', payload).then((r) => r.data);
export const updateTeamMember = (id, payload) =>
  axiosClient.put(`/team-members/${id}`, payload).then((r) => r.data);
export const deleteTeamMember = (id) =>
  axiosClient.delete(`/team-members/${id}`).then((r) => r.data);
