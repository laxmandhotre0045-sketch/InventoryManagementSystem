import axiosClient from './axiosClient';

const get = (url, params) => axiosClient.get(url, { params }).then((r) => r.data);

export const getPurchases = (params) => get('/purchases', params);
export const searchPurchases = (params) => get('/purchases/search', params);
export const getPurchaseById = (id) => get(`/purchases/${id}`);
export const getPurchaseSummary = (id) => get(`/purchases/${id}/summary`);
export const createPurchase = (payload) => axiosClient.post('/purchases', payload).then((r) => r.data);
export const deletePurchase = (id) => axiosClient.delete(`/purchases/${id}`).then((r) => r.data);

export const uploadInvoice = (id, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return axiosClient.post(`/purchases/${id}/upload-invoice`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

// Upload an invoice and get back structured, editable data from the OCR provider
// (mock today). The stored file is returned so it can be linked on confirmation.
export const extractInvoice = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return axiosClient.post('/purchases/extract-invoice', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);
};

// Confirm a reviewed invoice: creates approved new items, the purchase, stock-in
// and transactions, and links the invoice — atomically on the backend.
export const confirmInvoice = (payload) =>
  axiosClient.post('/purchases/confirm-invoice', payload).then((r) => r.data);

/**
 * Fetches a stored invoice as a blob.
 *
 * The endpoint is authenticated, so the file cannot simply be dropped into an
 * <img>/<iframe> src — the browser would issue that request without the bearer
 * token. Pulling it through axios and wrapping it in an object URL keeps the
 * Authorization header on the request.
 *
 * Callers must revokeObjectURL the result when done.
 */
export const fetchInvoiceBlob = async (id) => {
  const res = await axiosClient.get(`/purchases/${id}/invoice`, { responseType: 'blob' });
  const type = res.data?.type || res.headers?.['content-type'] || 'application/octet-stream';
  return { url: URL.createObjectURL(res.data), contentType: type };
};

/** Saves the invoice to disk under its original file name. */
export const downloadInvoice = async (id, filename) => {
  const res = await axiosClient.get(`/purchases/${id}/invoice`, {
    params: { download: true },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `invoice-${id}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
