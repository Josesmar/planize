import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getFirebaseApp } from './firebaseApp'
import type { ExpenseTemplate, MonthData, UiPreferences } from '../types'
import { isValidAccessKey, newWorkspaceId, normalizeAccessKey } from '../utils/accessKey'

export type WorkspaceSlice = {
  months: MonthData[]
  currentMonthId: string
  ui: UiPreferences
  templates: ExpenseTemplate[]
}

function stripForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T
}

export type WorkspaceMeta = {
  ownerEmail: string
  allowedEmails: string[]
}

function normalizeControlCode(raw: string): string {
  return normalizeAccessKey(raw)
}

/** Titular: cria chave + documento inicial na nuvem. */
export async function createOwnerSpace(
  keyId: string,
  ownerEmail: string,
  slice: WorkspaceSlice
): Promise<string> {
  const db = getFirestore(getFirebaseApp())
  const email = ownerEmail.toLowerCase()
  const wsId = newWorkspaceId()
  const body = stripForFirestore({
    ...slice,
    ownerEmail: email,
    allowedEmails: [email],
    revision: 1,
  })

  await runTransaction(db, async tx => {
    const dirRef = doc(db, 'spaceDirectory', keyId)
    const dirSnap = await tx.get(dirRef)
    if (dirSnap.exists()) {
      throw new Error('Esta chave já está em uso. Escolha outra ou entre como convidado.')
    }
    const wsRef = doc(db, 'workspaces', wsId)
    tx.set(dirRef, {
      workspaceId: wsId,
      ownerEmail: email,
      accessKeyId: keyId,
      createdAt: serverTimestamp(),
    })
    tx.set(wsRef, {
      ...body,
      accessKeyId: keyId,
      updatedAt: serverTimestamp(),
    })
  })
  return wsId
}

/** Titular noutro aparelho: mesma chave + mesmo email. */
export async function connectExistingOwner(keyId: string, ownerEmail: string): Promise<{
  workspaceId: string
  meta: WorkspaceMeta
}> {
  const db = getFirestore(getFirebaseApp())
  const email = ownerEmail.toLowerCase()
  const dirSnap = await getDoc(doc(db, 'spaceDirectory', keyId))
  if (!dirSnap.exists()) throw new Error('Chave não encontrada. Verifique com o titular.')
  const d = dirSnap.data() as { workspaceId: string; ownerEmail: string }
  if (d.ownerEmail.toLowerCase() !== email) {
    throw new Error('Este email não é o titular desta chave. Use "Pedir acesso como convidado".')
  }
  const wsSnap = await getDoc(doc(db, 'workspaces', d.workspaceId))
  if (!wsSnap.exists()) throw new Error('Dados do espaço em falta na nuvem.')
  const w = wsSnap.data() as { allowedEmails?: string[]; ownerEmail: string }
  const allowed = Array.isArray(w.allowedEmails) ? w.allowedEmails.map(x => String(x).toLowerCase()) : [email]
  return {
    workspaceId: d.workspaceId,
    meta: { ownerEmail: w.ownerEmail.toLowerCase(), allowedEmails: allowed },
  }
}

/**
 * Cria um "controle" por código (ex.: 12345) e define o utilizador atual como owner.
 * O código pode ser usado por outros utilizadores para entrar no mesmo workspace.
 */
export async function createWorkspaceByControlCode(
  controlCodeRaw: string,
  ownerEmail: string,
  slice: WorkspaceSlice
): Promise<string> {
  const keyId = normalizeControlCode(controlCodeRaw)
  if (!isValidAccessKey(keyId)) throw new Error('Código de controle inválido (mínimo 4 caracteres).')
  return createOwnerSpace(keyId, ownerEmail, slice)
}

/**
 * Entra num controle existente pelo código e adiciona o email do utilizador na ACL.
 */
export async function joinWorkspaceByControlCode(controlCodeRaw: string, memberEmail: string): Promise<{
  workspaceId: string
  meta: WorkspaceMeta
}> {
  const keyId = normalizeControlCode(controlCodeRaw)
  if (!isValidAccessKey(keyId)) throw new Error('Código de controle inválido (mínimo 4 caracteres).')

  const db = getFirestore(getFirebaseApp())
  const me = memberEmail.toLowerCase()
  const dirSnap = await getDoc(doc(db, 'spaceDirectory', keyId))
  if (!dirSnap.exists()) throw new Error('Controle não encontrado. Verifique o código.')
  const d = dirSnap.data() as { workspaceId: string; ownerEmail: string }
  const wsRef = doc(db, 'workspaces', d.workspaceId)

  const wsEarly = await getDoc(wsRef)
  if (wsEarly.exists()) {
    const w0 = wsEarly.data() as { allowedEmails?: string[]; ownerEmail: string }
    const allowed0 = (w0.allowedEmails ?? [w0.ownerEmail]).map(x => String(x).toLowerCase())
    if (allowed0.includes(me)) {
      return {
        workspaceId: d.workspaceId,
        meta: {
          ownerEmail: String(w0.ownerEmail).toLowerCase(),
          allowedEmails: [...new Set(allowed0)].sort(),
        },
      }
    }
  }

  await runTransaction(db, async tx => {
    const wsSnap = await tx.get(wsRef)
    if (!wsSnap.exists()) throw new Error('Dados do controle em falta na nuvem.')
    tx.update(wsRef, {
      allowedEmails: arrayUnion(me),
      updatedAt: serverTimestamp(),
    })
  })

  const wsSnap = await getDoc(wsRef)
  if (!wsSnap.exists()) throw new Error('Dados do controle em falta na nuvem.')
  const w = wsSnap.data() as { ownerEmail: string; allowedEmails?: string[] }
  const owner = String(w.ownerEmail).toLowerCase()
  const allowed = Array.isArray(w.allowedEmails)
    ? w.allowedEmails.map(x => String(x).toLowerCase())
    : [owner, me]
  return {
    workspaceId: d.workspaceId,
    meta: { ownerEmail: owner, allowedEmails: [...new Set(allowed)].sort() },
  }
}

/** Convidado: cria pedido pendente de aprovação. */
export async function createGuestJoinRequest(keyId: string, guestEmail: string): Promise<
  | { kind: 'owner_same_device'; workspaceId: string; meta: WorkspaceMeta }
  | { kind: 'already_member'; workspaceId: string; meta: WorkspaceMeta }
  | { kind: 'pending'; requestId: string }
> {
  const db = getFirestore(getFirebaseApp())
  const go = guestEmail.toLowerCase()
  const dirRef = doc(db, 'spaceDirectory', keyId)
  const dirSnap = await getDoc(dirRef)
  if (!dirSnap.exists()) throw new Error('Chave não encontrada. Confirme a chave com o titular.')
  const { workspaceId, ownerEmail } = dirSnap.data() as { workspaceId: string; ownerEmail: string }
  const oo = ownerEmail.toLowerCase()

  const wsSnapEarly = await getDoc(doc(db, 'workspaces', workspaceId))
  if (wsSnapEarly.exists()) {
    const w0 = wsSnapEarly.data() as { allowedEmails?: string[]; ownerEmail: string }
    const allowed0 = (w0.allowedEmails ?? [w0.ownerEmail]).map(x => String(x).toLowerCase())
    if (allowed0.includes(go)) {
      return {
        kind: 'already_member',
        workspaceId,
        meta: { ownerEmail: oo, allowedEmails: allowed0 },
      }
    }
  }

  if (go === oo) {
    const wsSnap = await getDoc(doc(db, 'workspaces', workspaceId))
    if (!wsSnap.exists()) throw new Error('Espaço em falta.')
    const w = wsSnap.data() as { allowedEmails?: string[]; ownerEmail: string }
    const allowed = Array.isArray(w.allowedEmails) ? w.allowedEmails.map(x => String(x).toLowerCase()) : [oo]
    return { kind: 'owner_same_device', workspaceId, meta: { ownerEmail: oo, allowedEmails: allowed } }
  }

  const docRef = await addDoc(collection(db, 'joinRequests'), {
    accessKeyId: keyId,
    guestEmail: go,
    ownerEmail: oo,
    workspaceId,
    status: 'pending',
    createdAt: serverTimestamp(),
  })

  try {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
    await fetch('/api/notify-join-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerEmail: oo,
        guestEmail: go,
        accessKeyId: keyId,
        appUrl,
      }),
    })
  } catch {
    /* email opcional se API não existir */
  }

  return { kind: 'pending', requestId: docRef.id }
}

export async function fetchWorkspaceMeta(workspaceId: string): Promise<WorkspaceMeta> {
  const db = getFirestore(getFirebaseApp())
  const ws = await getDoc(doc(db, 'workspaces', workspaceId))
  if (!ws.exists()) throw new Error('Espaço não encontrado na nuvem.')
  const w = ws.data() as { ownerEmail: string; allowedEmails?: string[] }
  const oe = String(w.ownerEmail).toLowerCase()
  const allowed = Array.isArray(w.allowedEmails)
    ? w.allowedEmails.map(x => String(x).toLowerCase())
    : [oe]
  return { ownerEmail: oe, allowedEmails: allowed }
}

export async function approveJoinRequest(requestId: string): Promise<void> {
  const auth = getAuth(getFirebaseApp())
  const me = auth.currentUser?.email?.toLowerCase()
  if (!me) throw new Error('Inicie sessão para aprovar.')

  const db = getFirestore(getFirebaseApp())
  const ref = doc(db, 'joinRequests', requestId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Pedido inexistente.')
  const d = snap.data() as { ownerEmail: string; guestEmail: string; workspaceId: string; status: string }
  if (d.ownerEmail !== me) throw new Error('Só o titular pode aprovar.')
  if (d.status !== 'pending') throw new Error('Este pedido já foi tratado.')

  await runTransaction(db, async tx => {
    const req = await tx.get(ref)
    if (!req.exists()) throw new Error('Pedido inexistente.')
    const r = req.data() as typeof d
    if (r.status !== 'pending') return
    const wsRef = doc(db, 'workspaces', r.workspaceId)
    const ws = await tx.get(wsRef)
    if (!ws.exists()) throw new Error('Workspace inexistente.')
    tx.update(ref, { status: 'approved', decidedAt: serverTimestamp() })
    tx.update(wsRef, { allowedEmails: arrayUnion(r.guestEmail) })
  })
}

export async function rejectJoinRequest(requestId: string): Promise<void> {
  const auth = getAuth(getFirebaseApp())
  const me = auth.currentUser?.email?.toLowerCase()
  if (!me) throw new Error('Inicie sessão.')

  const db = getFirestore(getFirebaseApp())
  const ref = doc(db, 'joinRequests', requestId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Pedido inexistente.')
  const d = snap.data() as { ownerEmail: string; status: string }
  if (d.ownerEmail !== me) throw new Error('Só o titular pode recusar.')
  if (d.status !== 'pending') return
  await updateDoc(ref, { status: 'rejected', decidedAt: serverTimestamp() })
}

export function subscribeOwnerPendingRequests(
  ownerEmail: string,
  onList: (items: { id: string; guestEmail: string; accessKeyId: string; workspaceId: string }[]) => void
): () => void {
  const db = getFirestore(getFirebaseApp())
  const q = query(
    collection(db, 'joinRequests'),
    where('ownerEmail', '==', ownerEmail.toLowerCase()),
    where('status', '==', 'pending')
  )
  return onSnapshot(
    q,
    snap => {
      const items = snap.docs.map(d => {
        const x = d.data() as { guestEmail: string; accessKeyId: string; workspaceId: string }
        return { id: d.id, guestEmail: x.guestEmail, accessKeyId: x.accessKeyId, workspaceId: x.workspaceId }
      })
      onList(items)
    },
    err => console.error('joinRequests snapshot', err)
  )
}

export function subscribeGuestJoinRequest(
  requestId: string,
  guestEmail: string,
  onApproved: (workspaceId: string) => void,
  onRejected: () => void
): () => void {
  const db = getFirestore(getFirebaseApp())
  const ref = doc(db, 'joinRequests', requestId)
  const ge = guestEmail.toLowerCase()
  return onSnapshot(ref, snap => {
    if (!snap.exists()) return
    const d = snap.data() as { status: string; guestEmail: string; workspaceId: string }
    if (d.guestEmail !== ge) return
    if (d.status === 'approved') onApproved(d.workspaceId)
    if (d.status === 'rejected') onRejected()
  })
}
