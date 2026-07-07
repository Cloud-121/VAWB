import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves from /REPO_NAME/ — set GITHUB_PAGES=true when building for deploy
const base = process.env.GITHUB_PAGES === 'true' ? '/VAWB/' : '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/auth': 'http://localhost:3001',
    },
  },
});
