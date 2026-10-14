import axiosClient from './axiosClient';

/**
 * Check a BOM / Excel parts list against inventory. Read-only on the server —
 * nothing is created or changed. `boards` multiplies every BOM quantity.
 */
export const checkBom = (file, boards = 1) => {
  const form = new FormData();
  form.append('file', file);
  form.append('boards', String(boards));
  return axiosClient
    .post('/bom/check', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data);
};
