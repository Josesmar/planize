/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Injeta `vite.config.ts` `define` — muda a cada `vite build` / arranque do `vite dev`. */
declare const __BUILD_STAMP__: string

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  /** URL pública do site (ex.: https://planize.vercel.app/) para o link mágico de email */
  readonly VITE_APP_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
