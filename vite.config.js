import { defineConfig } from 'vite';

// Project Pages: https://<user>.github.io/learnmlmath/
const isPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  root: '.',
  base: isPages ? '/learnmlmath/' : '/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  server: {
    port: 5173,
  },
});
