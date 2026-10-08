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
      // No includeAssets: favicon.svg is 412 KB and is fetched directly by the
      // browser via <link rel="icon">, so precaching it made every PWA install
      // download it for no benefit. It now rides the browser's HTTP cache.
      workbox: {
        cleanupOutdatedCaches: true,
        // Precache only what is needed to boot and paint. Previously this glob
        // swept every png/svg/woff2 in dist/, so a first visit downloaded the
        // whole 2.9 MB output before the app was usable.
        globPatterns: ['**/*.{js,css,html,woff2}'],
        // Images are excluded by the glob above rather than by size, so the
        // oversize logos can never be swept into the precache. The cap is sized
        // for the app shell: the Firebase SDK is the largest precached chunk and
        // is required for the app to boot offline at all.
        maximumFileSizeToCacheInBytes: 700 * 1024,
        // Without runtime caching the self-hosted fonts were re-fetched on every
        // visit by an install that had already paid for them.
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith('/fonts/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'sbconnect-fonts',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'sbconnect-images',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'SB Connect',
        short_name: 'SB Connect',
        description: 'Business networking and membership management for SB Connect',
        theme_color: '#2A11A6',
        background_color: '#FAF9FC',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/sbconnect-logo-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/sbconnect-logo-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  build: {
    // Matches the ES target in tsconfig.app.json. Left at Vite's default
    // baseline, the app was being down-levelled further than necessary.
    target: 'es2023',
    // The firebase chunk is legitimately large and expected; silence the warning
    // so a real regression stands out instead of being lost in known noise.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) return 'vendor';
          if (id.includes('node_modules/firebase/')) return 'firebase';
          // NOTE: no manual chunk for qrcode.react. Naming it here forced the
          // module into the static graph, which put it back in the entry's
          // modulepreload list even though it is only ever dynamically imported.
          // Letting the dynamic import in Admin.tsx chunk it automatically keeps
          // it off the critical path.
        },
      },
    },
  },
})