import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `base: './'` keeps asset URLs relative so the same build works on
// GitHub Pages (sub-path), any static host, and inside the Capacitor Android shell.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Muster & Battle — 40k List Builder',
        short_name: 'Muster',
        description: 'Build Warhammer 40,000 army lists and play games step by step.',
        theme_color: '#14161c',
        background_color: '#14161c',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Catalogue data is cached in IndexedDB by the app itself, so the
        // service worker only needs the app shell.
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
});
