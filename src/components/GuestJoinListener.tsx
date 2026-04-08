import { useEffect, useRef } from 'react'
import { useFirebaseAuth } from '../auth/FirebaseAuthProvider'
import { useStore } from '../store'
import { fetchWorkspaceMeta, subscribeGuestJoinRequest } from '../sync/workspaceAcl'

/** Convidado: quando o titular aprovar, liga o workspace automaticamente. */
export function GuestJoinListener() {
  const pendingId = useStore(s => s.pendingJoinRequestId)
  const setSyncWorkspaceId = useStore(s => s.setSyncWorkspaceId)
  const setSyncWorkspaceMeta = useStore(s => s.setSyncWorkspaceMeta)
  const setPendingJoinRequestId = useStore(s => s.setPendingJoinRequestId)
  const { user } = useFirebaseAuth()
  const handled = useRef(false)

  useEffect(() => {
    handled.current = false
  }, [pendingId])

  useEffect(() => {
    if (!pendingId || !user?.email) return
    const email = user.email
    return subscribeGuestJoinRequest(
      pendingId,
      email,
      async workspaceId => {
        if (handled.current) return
        handled.current = true
        try {
          const meta = await fetchWorkspaceMeta(workspaceId)
          setSyncWorkspaceMeta({
            ownerEmail: meta.ownerEmail,
            allowedEmails: [...new Set(meta.allowedEmails)].sort(),
          })
          setSyncWorkspaceId(workspaceId)
          setPendingJoinRequestId(null)
        } catch (e) {
          console.error(e)
        }
      },
      () => {
        setPendingJoinRequestId(null)
      }
    )
  }, [pendingId, user?.email, setSyncWorkspaceId, setSyncWorkspaceMeta, setPendingJoinRequestId])

  return null
}
