import axiosClient from '../axiosClient';

// Library — Members API.
const get = (url, params) => axiosClient.get(url, { params }).then((r) => r.data);

export const getMembers = (params) => get('/library/members', params);
export const getMember = (id) => get(`/library/members/${id}`);
export const getMemberHistory = (id, params) => get(`/library/members/${id}/history`, params);
export const createMember = (payload) => axiosClient.post('/library/members', payload).then((r) => r.data);
export const updateMember = (id, payload) => axiosClient.put(`/library/members/${id}`, payload).then((r) => r.data);
export const deleteMember = (id) => axiosClient.delete(`/library/members/${id}`).then((r) => r.data);
