import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const buildStamp = new Date().toISOString().slice(0, 19).replace('T', ' ')

/** Escreve `dist/planize-version.json` para a app em produção detetar deploy novo sem depender só do SW. */
function planizeVersionFilePlugin() {
  return {
    name: 'planize-version-file',
    writeBundle() {
      const dir = resolve(process.cwd(), 'dist')
      try {
        mkdirSync(dir, { recursive: true })
      } catch {
        /* ignore */
      }
      writeFileSync(resolve(dir, 'planize-version.json'), JSON.stringify({ build: buildStamp }), 'utf8')
    },
  }
}

export default defineConfig({
  define: {
    __BUILD_STAMP__: JSON.stringify(buildStamp),
  },
  plugins: [
    react(),
    planizeVersionFilePlugin(),
    VitePWA({
      /** `prompt` + `registerSW` no cliente: ao detetar novo SW chamamos reload (mais fiável que só autoUpdate em iOS/PWA). */
      registerType: 'prompt',
      injectRegister: false,
      /**
       * PWA desligado em dev: com `enabled: true` o SW pode servir bundle antigo após
       * alterações no código (ex.: totais da planilha parecem “não atualizar”).
       * Para testar PWA: `npm run build && npm run preview`.
       */
      devOptions: { enabled: false },
      minify: false,
      includeAssets: ['icon-192.svg', 'icon-512.svg'],
      manifest: {
        name: 'Planize',
        short_name: 'Planize',
        description: 'Planejamento e controle de finanças pessoais e do lar',
        theme_color: '#070B14',
        background_color: '#070B14',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: 'icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          }
        ]
      }
    })
  ]
})
