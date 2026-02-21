/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/frontend/rating-workspace',
  server: {
    port: 4200,
    host: 'localhost',
    proxy: {
      '/api/product-config': {
        target: 'http://localhost:4010',
        rewrite: (path) => path.replace(/^\/api\/product-config/, '/api/v1'),
      },
      '/api/rules': {
        target: 'http://localhost:4012',
        rewrite: (path) => path.replace(/^\/api\/rules/, '/api/v1'),
      },
      '/api/transform': {
        target: 'http://localhost:4011',
        rewrite: (path) => path.replace(/^\/api\/transform/, '/api/v1'),
      },
      '/api/status': {
        target: 'http://localhost:4013',
        rewrite: (path) => path.replace(/^\/api\/status/, '/api/v1'),
      },
      '/api/core-rating': {
        target: 'http://localhost:4000',
        rewrite: (path) => path.replace(/^\/api\/core-rating/, '/api/v1'),
      },
      '/api/line-rating': {
        target: 'http://localhost:4001',
        rewrite: (path) => path.replace(/^\/api\/line-rating/, '/api/v1'),
      },
    },
  },
  preview: {
    port: 4200,
    host: 'localhost',
  },
  plugins: [tailwindcss(), react()],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));
