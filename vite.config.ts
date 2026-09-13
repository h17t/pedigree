import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * Single source of truth for the deployment base path. GitHub Pages serves a project site
 * from /<repo>/, so the default matches the repository name. Override with
 * VITE_BASE_PATH=/ to serve from a user page or a custom domain.
 */
const base = process.env.VITE_BASE_PATH ?? '/pedigree/';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    manifest: true,
    rollupOptions: {
      output: {
        // Keep vendor code in its own long-lived chunk so app changes do not invalidate it.
        manualChunks: {
          vendor: ['react', 'react-dom', 'zustand', 'immer'],
        },
      },
    },
  },
});
