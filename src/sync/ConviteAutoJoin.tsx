import { useEffect, useRef } from 'react'
import { useFirebaseAuth } from '../auth/FirebaseAuthProvider'
import { useStore } from '../store'
import { accessKeyFromOwnerEmail } from '../utils/accessKey'
import { isFirebaseConfigured } from './firebaseApp'
import { createGuestJoinRequest } from './workspaceAcl'
import { PLANIZE_CONVITE_OWNER_KEY } from './ConviteQueryCapture'

export const PLANIZE_INVITE_NOTICE_KEY = 'planize_invite_notice'

/** Convidado que entrou pelo link do email: pede acesso automaticamente. */
export function ConviteAutoJoin() {
  const { user, loading } = useFirebaseAuth()
  const syncWorkspaceId = useStore(s => s.syncWorkspaceId)
  const setSyncWorkspaceId = useStore(s => s.setSyncWorkspaceId)
  const setSyncWorkspaceMeta = useStore(s => s.setSyncWorkspaceMeta)
  const setPendingJoinRequestId = useStore(s => s.setPendingJoinRequestId)
  const inFlight = useRef(false)

  useEffect(() => {
    if (!isFirebaseConfigured() || loading || !user?.email || syncWorkspaceId || inFlight.current) return

    const guestEmail = user.email
    const ownerHint = sessionStorage.getItem(PLANIZE_CONVITE_OWNER_KEY)
    if (!ownerHint) return

    const me = guestEmail.toLowerCase()
    if (me === ownerHint) {
      sessionStorage.removeItem(PLANIZE_CONVITE_OWNER_KEY)
      return
    }

    inFlight.current = true
    void (async () => {
      try {
        const key = accessKeyFromOwnerEmail(ownerHint)
        const r = await createGuestJoinRequest(key, guestEmail)
        sessionStorage.removeItem(PLANIZE_CONVITE_OWNER_KEY)
        if (r.kind === 'pending') {
          setPendingJoinRequestId(r.requestId)
          sessionStorage.setItem(
            PLANIZE_INVITE_NOTICE_KEY,
            'Pedido enviado. O titular pode aprovar no aviso no topo do ecrã.'
          )
          return
        }
        setSyncWorkspaceMeta({
          ownerEmail: r.meta.ownerEmail,
          allowedEmails: [...new Set(r.meta.allowedEmails)].sort(),
        })
        setSyncWorkspaceId(r.workspaceId)
        setPendingJoinRequestId(null)
      } catch (e) {
        const m = e instanceof Error ? e.message : ''
        if (m.includes('não encontrada')) {
          sessionStorage.setItem(
            PLANIZE_INVITE_NOTICE_KEY,
            'O titular ainda não ativou a nuvem. Peça-lhe para abrir Ajustes e tocar em «Ativar na nuvem»; depois abra de novo o link do seu email.'
          )
        } else {
          sessionStorage.setItem(PLANIZE_INVITE_NOTICE_KEY, m || 'Não foi possível pedir acesso.')
          sessionStorage.removeItem(PLANIZE_CONVITE_OWNER_KEY)
        }
      } finally {
        inFlight.current = false
      }
    })()
  }, [loading, user?.email, syncWorkspaceId, setSyncWorkspaceId, setSyncWorkspaceMeta, setPendingJoinRequestId])

  return null
}
