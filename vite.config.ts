import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['sbconnect-logo.png'],
      manifest: {
        name: 'SB Connect',
        short_name: 'SB Connect',
        description: 'Business networking and membership management for SB Connect',
        theme_color: '#2A11A6',
        background_color: '#FAF8F5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/sbconnect-logo.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/sbconnect-logo.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) return 'vendor';
          if (id.includes('node_modules/firebase/')) return 'firebase';
          if (id.includes('node_modules/qrcode.react')) return 'qr';
        },
      },
    },
  },
})
