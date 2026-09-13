import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
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
  plugins: [
    react(),
    // Offline support: precache the whole build, serve navigations from the cached shell, and
    // never update silently (registerType 'prompt' shows the in-app "new version" banner).
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.svg', 'fonts/*.woff2', 'icons/*.png'],
      manifest: {
        id: base,
        name: 'Pedigree',
        short_name: 'Pedigree',
        description: 'A family tree editor that keeps all data on your device.',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#F3F4F2',
        theme_color: '#F3F4F2',
        lang: 'en',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest,txt}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
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
