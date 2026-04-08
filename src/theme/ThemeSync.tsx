import { useEffect } from 'react'
import { useStore } from '../store'
import { syncDocumentTheme } from './syncDocumentTheme'

/**
 * Mantém <html class="light"> alinhado ao Zustand após reidratar e em toda mudança de theme.
 * O merge do persist pode ter deixado `ui` incompleto; updateUi já chama sync na hora do clique.
 */
export function ThemeSync() {
  useEffect(() => {
    const apply = () => syncDocumentTheme(useStore.getState().ui?.theme ?? 'dark')

    if (useStore.persist.hasHydrated()) apply()

    const unsubHydrate = useStore.persist.onFinishHydration(() => {
      apply()
    })

    const unsubStore = useStore.subscribe((state, prev) => {
      const t = state.ui?.theme ?? 'dark'
      const pt = prev.ui?.theme ?? 'dark'
      if (t !== pt) syncDocumentTheme(t)
    })

    return () => {
      unsubHydrate()
      unsubStore()
    }
  }, [])

  return null
}
