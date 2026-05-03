import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/plotter/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Plotter',
        short_name: 'Plotter',
        description: 'Cemetery plot management for Clark County Cemetery District #6',
        theme_color: '#0f1114',
        background_color: '#0a0b0d',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/plotter/',
        scope: '/plotter/',
        icons: [
          { src: '/plotter/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/plotter/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/plotter/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
}))