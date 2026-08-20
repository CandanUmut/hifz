import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

/**
 * `base: './'` plus HashRouter means one build works from a domain root and
 * from a project sub-path such as /hifz/ without a rebuild.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // Relative so the manifest resolves correctly under a sub-path too.
      manifest: {
        name: 'hifz — memorise and keep it',
        short_name: 'hifz',
        description:
          'Memorise text word for word and keep it memorised. Everything stays on your device.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#EEF0EA',
        theme_color: '#EEF0EA',
        categories: ['education', 'books'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Start review', short_name: 'Review', url: './#/review' },
          { name: 'Library', short_name: 'Library', url: './#/library' },
        ],
      },
      workbox: {
        /*
         * The shell, the fonts and the pack index are precached, so a first
         * offline launch works. The per-surah files are not: there are 38 of
         * them and most readers open a handful, so they are cached the first
         * time they are actually opened.
         */
        globPatterns: [
          '**/*.{js,css,html,woff2}',
          'icons/*.png',
          'packs/index.json',
          'packs/*/pack.json',
        ],
        globIgnores: [
          'packs/*/[0-9]*.json',
          // The speech stack is opt-in and enormous; it must never ride along
          // in the install of an app most readers use without it.
          'assets/transformers*.js',
          'assets/ort-*',
          '**/*.wasm',
        ],
        // The 23 MB onnxruntime binary would blow past the default 2 MB cap.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        /*
         * Claim on first install so the opening visit is already cached, but
         * never skipWaiting: an update must not swap the page out from under
         * someone mid-review. `registerType: 'prompt'` asks first.
         */
        clientsClaim: true,
        skipWaiting: false,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/packs\/.+\/\d+\.json$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'hifz-pack-texts',
              expiration: { maxEntries: 250, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  base: './',
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: { target: 'es2020' },
})
