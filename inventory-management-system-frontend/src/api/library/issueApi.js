import axiosClient from '../axiosClient';

// Library — Issue / Return API and reports.
const get = (url, params) => axiosClient.get(url, { params }).then((r) => r.data);

export const getIssues = (params) => get('/library/issues', params);
export const getIssue = (id) => get(`/library/issues/${id}`);
export const issueBook = (payload) => axiosClient.post('/library/issues', payload).then((r) => r.data);
export const returnBook = (payload) => axiosClient.post('/library/issues/return', payload).then((r) => r.data);
export const getIssueHistory = (params) => get('/library/issues/history', params);
export const getReturnedReport = (params) => get('/library/issues/reports/returned', params);
export const getOverdueReport = (params) => get('/library/issues/reports/overdue', params);
export const getMostBorrowed = (params) => get('/library/issues/reports/most-borrowed', params);
