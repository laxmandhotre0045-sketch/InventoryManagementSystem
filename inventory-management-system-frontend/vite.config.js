import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Local `npm run dev` proxies /api to the backend. Matches BACKEND_PORT in .env.
      '/api': {
        target: 'http://localhost:8091',
        changeOrigin: true,
      },
    },
  },
});
