import axiosClient from '../axiosClient';

// Library — Books API. Responses use the shared ApiResponse envelope
// { success, message, data }; paged payloads live at data.content.
const get = (url, params) => axiosClient.get(url, { params }).then((r) => r.data);

export const getBooks = (params) => get('/library/books', params);
export const getBook = (id) => get(`/library/books/${id}`);
export const getBookCategories = () => get('/library/books/categories');
export const createBook = (payload) => axiosClient.post('/library/books', payload).then((r) => r.data);
export const updateBook = (id, payload) => axiosClient.put(`/library/books/${id}`, payload).then((r) => r.data);
export const deleteBook = (id) => axiosClient.delete(`/library/books/${id}`).then((r) => r.data);
