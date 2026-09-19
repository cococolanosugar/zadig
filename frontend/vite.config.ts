import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://192.168.31.174:8380',
        changeOrigin: true,
      },
      '/dex': {
        target: 'http://192.168.31.174:8380',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://192.168.31.174:8380',
        ws: true,
      },
    },
  },
});
