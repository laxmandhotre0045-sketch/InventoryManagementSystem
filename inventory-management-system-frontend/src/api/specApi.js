import axiosClient from './axiosClient';

// Specifications (name/value rows) of components and equipment.
// itemType: 'components' | 'equipment'
export const getSpecifications = (itemType, id) =>
  axiosClient.get(`/${itemType}/${id}/specifications`).then((r) => r.data);

/** Replaces the whole list — the editor saves all rows (added, edited, removed, reordered) at once. */
export const saveSpecifications = (itemType, id, entries) =>
  axiosClient.put(`/${itemType}/${id}/specifications`, entries).then((r) => r.data);
