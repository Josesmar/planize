import { useEffect } from 'react'

const STORAGE_OWNER = 'planize_convite_owner'

/** Grava ?convite= do URL antes do onboarding / login e limpa a barra de endereço. */
export function ConviteQueryCapture() {
  useEffect(() => {
    try {
      const u = new URL(window.location.href)
      const c = u.searchParams.get('convite')?.trim()
      if (c?.includes('@')) {
        sessionStorage.setItem(STORAGE_OWNER, c.toLowerCase())
        u.searchParams.delete('convite')
        const next = u.pathname + (u.search ? u.search : '') + u.hash
        window.history.replaceState(null, '', next)
      }
    } catch {
      /* ignore */
    }
  }, [])
  return null
}

export { STORAGE_OWNER as PLANIZE_CONVITE_OWNER_KEY }
