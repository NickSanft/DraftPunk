import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH env var lets CI inject the GitHub Pages subpath
// (eg "/DraftPunk/") at build time. Defaults to "/" so dev and
// custom-domain deploys work without configuration.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    port: 5173,
  },
});
