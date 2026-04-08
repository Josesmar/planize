import type { User } from 'firebase/auth'
import {
  doc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentReference,
} from 'firebase/firestore'
import type { StoreApi } from 'zustand'
import type { AppState, PersonIncome, SyncWorkspaceMeta } from '../types'
import {
  DEFAULT_UI_PREFERENCES,
  type ExpenseTemplate,
  type MonthData,
} from '../types'
import { ensureIncomeSlots, migrateLegacyIncome } from '../utils/incomeModel'
import { coerceUiPreferences } from '../utils/uiPrefs'
import { getFirebaseApp, isFirebaseConfigured } from './firebaseApp'
import { useSyncUiStore } from './syncUiStore'

type AppStore = StoreApi<AppState>

let fireUnsub: (() => void) | undefined
let storeUnsub: (() => void) | undefined
let pushTimer: ReturnType<typeof setTimeout> | undefined
let applyingRemote = false
let lastComparableJson = ''
let seedRequested = false

function pickSlice(state: AppState) {
  return {
    months: state.months,
    currentMonthId: state.currentMonthId,
    ui: state.ui,
    templates: state.templates,
  }
}

function serializeComparable(state: AppState): string {
  return JSON.stringify({
    ...pickSlice(state),
    acl: state.syncWorkspaceMeta,
  })
}

/** Firestore não aceita `undefined` em mapas; remove com round-trip JSON. */
function stripForFirestore<T extends Record<string, unknown>>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T
}

function parseRemoteWorkspace(
  data: Record<string, unknown>
): { ok: true; slice: ReturnType<typeof pickSlice> } | { ok: false; reason: string } {
  if (!Array.isArray(data.months)) {
    return { ok: false, reason: 'months ausente ou não é lista' }
  }
  if (typeof data.currentMonthId !== 'string') {
    return { ok: false, reason: 'currentMonthId inválido' }
  }
  if (data.ui == null || typeof data.ui !== 'object') {
    return { ok: false, reason: 'ui inválido' }
  }
  const rawUi = { ...DEFAULT_UI_PREFERENCES, ...(data.ui as Record<string, unknown>) }
  const ui = coerceUiPreferences(rawUi as Record<string, unknown>)
  const monthsRaw = data.months as MonthData[]
  const monthsNorm = monthsRaw.map(m => ({
    ...m,
    income: ensureIncomeSlots(
      migrateLegacyIncome(m.income as Record<string, PersonIncome>),
      ui.incomeSlotCount
    ),
  }))
  const templates = Array.isArray(data.templates) ? (data.templates as ExpenseTemplate[]) : []
  return {
    ok: true,
    slice: {
      months: monthsNorm,
      currentMonthId: data.currentMonthId,
      ui,
      templates,
    },
  }
}

function readAcl(data: Record<string, unknown>): SyncWorkspaceMeta | null {
  if (typeof data.ownerEmail !== 'string' || !Array.isArray(data.allowedEmails)) return null
  return {
    ownerEmail: data.ownerEmail.toLowerCase(),
    allowedEmails: (data.allowedEmails as unknown[]).map(x => String(x).toLowerCase()),
  }
}

export function disconnectFirestoreSync() {
  fireUnsub?.()
  storeUnsub?.()
  clearTimeout(pushTimer)
  fireUnsub = undefined
  storeUnsub = undefined
  lastComparableJson = ''
  seedRequested = false
  useSyncUiStore.getState().reset()
}

function setStatus(
  p: { kind: 'disabled' } | { kind: 'connecting' } | { kind: 'synced'; at: number } | { kind: 'error'; message: string }
) {
  const setSyncUi = useSyncUiStore.getState().setSyncUi
  if (p.kind === 'disabled') setSyncUi({ kind: 'disabled', message: undefined })
  else if (p.kind === 'connecting') setSyncUi({ kind: 'connecting' })
  else if (p.kind === 'synced') setSyncUi({ kind: 'synced', lastAt: p.at, message: undefined })
  else setSyncUi({ kind: 'error', message: p.message })
}

async function pushWorkspaceDoc(ref: DocumentReference, store: AppStore) {
  const meta = store.getState().syncWorkspaceMeta
  if (!meta?.ownerEmail || !Array.isArray(meta.allowedEmails) || meta.allowedEmails.length === 0) {
    setStatus({
      kind: 'error',
      message: 'Configure o espaço na nuvem (chave + email) em Ajustes antes de sincronizar.',
    })
    return
  }

  const db = ref.firestore
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref)
    const prevRev = snap.exists() ? Number((snap.data() as { revision?: unknown }).revision ?? 0) : 0
    const slice = pickSlice(store.getState())
    const payload = stripForFirestore({
      ...slice,
      ownerEmail: meta.ownerEmail,
      allowedEmails: meta.allowedEmails,
      revision: prevRev + 1,
    } as Record<string, unknown>)
    tx.set(ref, {
      ...payload,
      updatedAt: serverTimestamp(),
    })
  })
  lastComparableJson = serializeComparable(store.getState())
  setStatus({ kind: 'synced', at: Date.now() })
}

export async function connectFirestoreSync(
  workspaceId: string,
  store: AppStore,
  authUser: User | null
): Promise<void> {
  disconnectFirestoreSync()

  if (!isFirebaseConfigured()) {
    setStatus({ kind: 'error', message: 'Serviço de nuvem indisponível nesta instalação.' })
    return
  }

  if (!authUser?.email) {
    setStatus({
      kind: 'error',
      message: 'Inicie sessão com email e senha em Ajustes → Nuvem.',
    })
    return
  }

  const email = authUser.email.toLowerCase()
  const localMeta = store.getState().syncWorkspaceMeta
  if (localMeta != null && !localMeta.allowedEmails.map(e => e.toLowerCase()).includes(email)) {
    setStatus({
      kind: 'error',
      message: 'O seu email ainda não está na lista deste espaço. Aguarde a aprovação do titular ou verifique a chave.',
    })
    return
  }

  setStatus({ kind: 'connecting' })
  const app = getFirebaseApp()
  const db = getFirestore(app)
  const ref = doc(db, 'workspaces', workspaceId)

  lastComparableJson = serializeComparable(store.getState())

  fireUnsub = onSnapshot(
    ref,
    snapshot => {
      if (!snapshot.exists()) {
        if (!seedRequested) {
          seedRequested = true
          void pushWorkspaceDoc(ref, store).catch(e => {
            setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Falha ao criar espaço' })
          })
        }
        return
      }

      const data = snapshot.data() as Record<string, unknown>
      const parsed = parseRemoteWorkspace(data)
      if (!parsed.ok) {
        setStatus({
          kind: 'error',
          message: `Nuvem: ${parsed.reason}. Verifique regras do Firestore e o formato do documento.`,
        })
        return
      }

      const acl = readAcl(data)
      if (!acl) {
        setStatus({
          kind: 'error',
          message:
            'Documento na nuvem sem lista de emails autorizados (formato antigo). Peça ao titular para criar um espaço novo com chave + email.',
        })
        return
      }

      if (!acl.allowedEmails.includes(email)) {
        setStatus({
          kind: 'error',
          message: 'O seu email não está autorizado neste espaço. Peça ao titular para aprovar o pedido.',
        })
        return
      }

      const slice = parsed.slice
      const tempState = {
        ...store.getState(),
        ...slice,
        syncWorkspaceMeta: acl,
      }
      const cmp = serializeComparable(tempState as AppState)
      if (cmp === lastComparableJson) {
        setStatus({ kind: 'synced', at: Date.now() })
        return
      }

      applyingRemote = true
      lastComparableJson = cmp
      store.setState({
        months: slice.months,
        currentMonthId: slice.currentMonthId,
        ui: slice.ui,
        templates: slice.templates,
        syncWorkspaceMeta: acl,
      })
      applyingRemote = false
      setStatus({ kind: 'synced', at: Date.now() })
    },
    err => {
      setStatus({ kind: 'error', message: err.message })
    }
  )

  storeUnsub = store.subscribe(state => {
    if (applyingRemote) return
    const cmp = serializeComparable(state)
    if (cmp === lastComparableJson) return
    clearTimeout(pushTimer)
    pushTimer = setTimeout(() => {
      void pushWorkspaceDoc(ref, store).catch(e => {
        setStatus({
          kind: 'error',
          message: e instanceof Error ? e.message : 'Erro ao sincronizar',
        })
      })
    }, 700)
  })

  setStatus({ kind: 'synced', at: Date.now() })
}
