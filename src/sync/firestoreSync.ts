import type { User } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
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
import { readGreetingNameFromDevice } from '../utils/greetingNameStorage'
import { getFirebaseApp, isFirebaseConfigured } from './firebaseApp'
import { useSyncUiStore } from './syncUiStore'

type AppStore = StoreApi<AppState>

let fireUnsub: (() => void) | undefined
let storeUnsub: (() => void) | undefined
let pushTimer: ReturnType<typeof setTimeout> | undefined
/** True enquanto `pushWorkspaceDoc` corre — evita snapshot antigo a sobrescrever `personLabels` a meio da edição. */
let pushInFlight = false
let applyingRemote = false
let lastComparableJson = ''
let seedRequested = false

/** Mantém os nomes das colunas locais alinhados ao `incomeSlotCount` remoto (durante debounce / push). */
function mergeLocalPersonLabels(store: AppStore, remoteUi: AppState['ui']): AppState['ui'] {
  const loc = store.getState().ui.personLabels
  const n = remoteUi.incomeSlotCount
  let merged = [...loc]
  while (merged.length < n) merged.push(`Pessoa ${merged.length + 1}`)
  if (merged.length > n) merged = merged.slice(0, n)
  return { ...remoteUi, personLabels: merged }
}

/** Evita o snapshot remoto (sem greetingName) apagar o nome já guardado localmente ou em localStorage. */
function mergeGreetingNameIntoUi(store: AppStore, remoteUi: AppState['ui']): AppState['ui'] {
  const loc = store.getState().ui.greetingName?.trim() ?? ''
  const fromLs = readGreetingNameFromDevice()
  const rem = remoteUi.greetingName?.trim() ?? ''
  const best = loc || fromLs || rem
  return { ...remoteUi, greetingName: best }
}

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

/** Conflito de transação: o documento mudou entre o read e o commit (outro separador, outro push, etc.). */
function isFirestoreTransactionVersionConflict(e: unknown): boolean {
  if (!(e instanceof FirebaseError) || e.code !== 'failed-precondition') return false
  return /stored version|required base version|base version/i.test(e.message)
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
  pushTimer = undefined
  pushInFlight = false
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

  pushInFlight = true
  try {
    const db = ref.firestore
    const maxOuterAttempts = 4
    let lastError: unknown
    for (let outer = 0; outer < maxOuterAttempts; outer++) {
      try {
        await runTransaction(
          db,
          async tx => {
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
          },
          { maxAttempts: 15 }
        )
        lastComparableJson = serializeComparable(store.getState())
        setStatus({ kind: 'synced', at: Date.now() })
        return
      } catch (e) {
        lastError = e
        if (!isFirestoreTransactionVersionConflict(e) || outer === maxOuterAttempts - 1) break
        await new Promise(r => setTimeout(r, 200 + outer * 200 + Math.random() * 400))
      }
    }
    const message =
      lastError instanceof Error ? lastError.message : 'Erro ao sincronizar com a nuvem.'
    setStatus({ kind: 'error', message })
  } finally {
    pushInFlight = false
  }
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
      const pendingLocalPush = pushTimer != null || pushInFlight
      const baseUi = pendingLocalPush ? mergeLocalPersonLabels(store, slice.ui) : slice.ui
      const uiToApply = mergeGreetingNameIntoUi(store, baseUi)
      store.setState({
        months: slice.months,
        currentMonthId: slice.currentMonthId,
        ui: uiToApply,
        templates: slice.templates,
        syncWorkspaceMeta: acl,
      })
      lastComparableJson = serializeComparable(store.getState())
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
      pushTimer = undefined
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
