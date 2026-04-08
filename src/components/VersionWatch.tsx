import { useCallback, useEffect, useState } from 'react'

const POLL_MS = 3 * 60 * 1000
const RELOAD_DELAY_MS = 2800

/**
 * Compara o build em execução com `/planize-version.json` no servidor (sem cache).
 * Se o deploy for mais recente, avisa e recarrega — útil quando o SW/iOS atrasa a atualização.
 */
export function VersionWatch() {
  const [showBanner, setShowBanner] = useState(false)

  const checkRemoteBuild = useCallback(async () => {
    if (!import.meta.env.PROD) return
    try {
      const res = await fetch(`/planize-version.json?${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return
      const data = (await res.json()) as { build?: string }
      if (typeof data.build !== 'string' || !data.build.trim()) return
      if (data.build.trim() === __BUILD_STAMP__.trim()) return
      setShowBanner(true)
      window.setTimeout(() => window.location.reload(), RELOAD_DELAY_MS)
    } catch {
      /* offline, etc. */
    }
  }, [])

  useEffect(() => {
    if (!import.meta.env.PROD) return
    const t0 = window.setTimeout(() => void checkRemoteBuild(), 5000)
    const id = window.setInterval(() => void checkRemoteBuild(), POLL_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') void checkRemoteBuild()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearTimeout(t0)
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [checkRemoteBuild])

  if (!showBanner) return null

  return (
    <div className="fixed left-2 right-2 top-[max(0.5rem,env(safe-area-inset-top))] z-[200] rounded-xl border border-primary/50 bg-surface px-4 py-3 text-center text-sm shadow-lg">
      <p className="font-semibold text-textMain">Nova versão do Planize</p>
      <p className="mt-1 text-xs text-muted">A página vai atualizar dentro de instantes…</p>
      <button
        type="button"
        className="mt-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white"
        onClick={() => window.location.reload()}
      >
        Atualizar agora
      </button>
    </div>
  )
}
