import axiosClient from './axiosClient';

// Notifications API. Responses use the shared { success, message, data } envelope.
const get = (url, params) => axiosClient.get(url, { params }).then((r) => r.data);

export const getNotifications = (params) => get('/notifications', params);
export const getRecentNotifications = () => get('/notifications/recent');
export const getUnreadCount = () => get('/notifications/unread-count');
export const markNotificationRead = (id) => axiosClient.put(`/notifications/${id}/read`).then((r) => r.data);
export const markAllNotificationsRead = () => axiosClient.put('/notifications/read-all').then((r) => r.data);
