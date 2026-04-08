import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { FirebaseAuthProvider, useFirebaseAuth } from './auth/FirebaseAuthProvider'
import LandingPage from './components/LandingPage'
import LoginScreen from './components/LoginScreen'
import { useStore } from './store'
import { ThemeSync } from './theme/ThemeSync'
import { isFirebaseConfigured } from './sync/firebaseApp'
import './index.css'
import { Wallet } from 'lucide-react'

/**
 * Opcional: `?planize-clear-cache=1` no URL para desregistar SW e limpar Cache API
 * (dev ou produção, se o PWA ficar preso a assets antigos).
 */
if (typeof window !== 'undefined') {
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('planize-clear-cache') === '1') {
      if ('serviceWorker' in navigator) {
        void navigator.serviceWorker.getRegistrations().then(regs => {
          for (const r of regs) void r.unregister()
        })
      }
      if ('caches' in window) {
        void caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      }
      q.delete('planize-clear-cache')
      const next = window.location.pathname + (q.toString() ? `?${q}` : '') + window.location.hash
      window.history.replaceState(null, '', next)
    }
  } catch {
    /* ignore */
  }
}

function Root() {
  return (
    <FirebaseAuthProvider>
      <ThemeSync />
      <RootContent />
    </FirebaseAuthProvider>
  )
}

function RootContent() {
  const onboardingDone = useStore(s => s.ui?.onboardingDone ?? false)
  const syncWorkspaceId = useStore(s => s.syncWorkspaceId)
  const syncWorkspaceMeta = useStore(s => s.syncWorkspaceMeta)
  const { user, loading } = useFirebaseAuth()

  if (isFirebaseConfigured()) {
    if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-textMain">Entrando no Planize</p>
              <p className="text-xs text-muted">A carregar sua sessão com segurança...</p>
            </div>
          </div>
        </div>
      )
    }
    if (!user) return <LoginScreen />
    const email = user.email?.toLowerCase() ?? ''
    const isAuthorizedInCurrentControl =
      syncWorkspaceId != null &&
      syncWorkspaceMeta != null &&
      syncWorkspaceMeta.allowedEmails.map(e => e.toLowerCase()).includes(email)
    if (!isAuthorizedInCurrentControl) return <LoginScreen />
  }

  return (
    <>
      {!onboardingDone ? <LandingPage /> : <App />}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
