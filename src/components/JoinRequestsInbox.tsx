import { useEffect, useState } from 'react'
import { useFirebaseAuth } from '../auth/FirebaseAuthProvider'
import { approveJoinRequest, rejectJoinRequest, subscribeOwnerPendingRequests } from '../sync/workspaceAcl'

type Item = { id: string; guestEmail: string; accessKeyId: string; workspaceId: string }

export function JoinRequestsInbox() {
  const { user } = useFirebaseAuth()
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.email) {
      setItems([])
      return
    }
    return subscribeOwnerPendingRequests(user.email, setItems)
  }, [user?.email])

  if (!user?.email || items.length === 0) return null

  async function approve(id: string) {
    setErr(null)
    setBusy(id)
    try {
      await approveJoinRequest(id)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao aprovar')
    } finally {
      setBusy(null)
    }
  }

  async function reject(id: string) {
    setErr(null)
    setBusy(id)
    try {
      await rejectJoinRequest(id)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao recusar')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mb-3 w-full max-w-3xl px-2 sm:mx-auto sm:px-4">
    <div className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-3 light:border-indigo-300 light:bg-indigo-50">
      <p className="text-xs font-bold text-primary light:text-indigo-900">Pedidos de acesso à nuvem</p>
      <ul className="mt-2 space-y-2">
        {items.map(it => (
          <li key={it.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface/80 p-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-textMain">{it.guestEmail}</p>
              <p className="text-[0.625rem] text-muted">
                Chave <span className="font-mono">{it.accessKeyId}</span>
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={busy === it.id}
                onClick={() => void approve(it.id)}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 light:bg-emerald-700"
              >
                Aprovar
              </button>
              <button
                type="button"
                disabled={busy === it.id}
                onClick={() => void reject(it.id)}
                className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-400 light:text-red-700 disabled:opacity-50"
              >
                Recusar
              </button>
            </div>
          </li>
        ))}
      </ul>
      {err ? <p className="mt-2 text-xs text-red-400 light:text-red-700">{err}</p> : null}
    </div>
    </div>
  )
}
