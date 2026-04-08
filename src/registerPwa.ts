import { registerSW } from 'virtual:pwa-register'

/**
 * Registo explícito do service worker (injectRegister: false no Vite).
 * Modo `prompt`: ao haver build novo, `onNeedRefresh` → ativa o SW e recarrega.
 * Também pede `registration.update()` com intervalo para detetar deploys sem o utilizador fechar a app.
 */
export function registerPlanizePwa(): void {
  if (!import.meta.env.PROD) return

  let updateSW: (reloadPage?: boolean) => Promise<void>

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true)
    },
    onOfflineReady() {},
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const tick = () => void registration.update()
      window.setInterval(tick, 45 * 60 * 1000)
      window.setTimeout(tick, 10_000)
    },
  })
}
