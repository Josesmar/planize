import { useEffect, useRef } from 'react'
import { useFirebaseAuth } from '../auth/FirebaseAuthProvider'
import { useStore } from '../store'
import { connectFirestoreSync, disconnectFirestoreSync } from './firestoreSync'
import { isFirebaseConfigured } from './firebaseApp'
import { useSyncUiStore } from './syncUiStore'

function waitForHydration(): Promise<void> {
  if (useStore.persist.hasHydrated()) return Promise.resolve()
  return new Promise(resolve => {
    useStore.persist.onFinishHydration(() => resolve())
  })
}

/** Conecta Firestore quando há workspace, Firebase e sessão por email. */
export function RemoteSyncBridge() {
  const workspaceId = useStore(s => s.syncWorkspaceId)
  const { user, loading } = useFirebaseAuth()
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false

    const run = async () => {
      await waitForHydration()
      if (cancelledRef.current) return

      if (!workspaceId) {
        disconnectFirestoreSync()
        return
      }

      if (!isFirebaseConfigured()) {
        useSyncUiStore.getState().setSyncUi({
          kind: 'error',
          message: 'Serviço de nuvem indisponível nesta instalação.',
        })
        return
      }

      if (loading) return

      try {
        await connectFirestoreSync(workspaceId, useStore, user)
      } catch (e) {
        useSyncUiStore.getState().setSyncUi({
          kind: 'error',
          message: e instanceof Error ? e.message : 'Falha ao conectar',
        })
      }
    }

    void run()

    return () => {
      cancelledRef.current = true
      disconnectFirestoreSync()
    }
  }, [workspaceId, user?.uid, loading])

  return null
}
