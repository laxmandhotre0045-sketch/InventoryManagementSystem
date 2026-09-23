import axiosClient from './axiosClient';

// Desktop (authenticated): create a session and poll for the extracted result.
export const createCaptureSession = () =>
  axiosClient.post('/mobile-capture/session').then((r) => r.data);

export const getCaptureResult = (sessionId) =>
  axiosClient.get(`/mobile-capture/${sessionId}/result`).then((r) => r.data);

// Public (no auth) — used by both the phone and, for status polling, the desktop.
export const getCaptureStatus = (sessionId) =>
  axiosClient.get(`/mobile-capture/${sessionId}/status`).then((r) => r.data);

// Phone: upload the captured invoice image to the session.
export const uploadCaptureImage = (sessionId, file) => {
  const form = new FormData();
  form.append('file', file);
  return axiosClient
    .post(`/mobile-capture/${sessionId}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
};
