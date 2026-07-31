import axiosClient from '../axiosClient';

// Library — Dashboard metrics.
export const getLibraryDashboard = () =>
  axiosClient.get('/library/dashboard').then((r) => r.data);
