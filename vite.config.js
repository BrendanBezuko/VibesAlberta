import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    open: true,
  },
});
