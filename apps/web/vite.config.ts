import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Local dev mirrors production: the app calls /api/*, which is forwarded to the
// API with the /api prefix removed (in production, functions/api/[[path]].ts).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
