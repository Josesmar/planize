import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { LEGACY_PERSIST_STORAGE_KEY, PERSIST_STORAGE_KEY } from '../constants/storageKeys'
import {
  AppState,
  AppTab,
  DEFAULT_UI_PREFERENCES,
  type SyncWorkspaceMeta,
  type Expense,
  type ExpenseTag,
  type ExpenseTemplate,
  type Income,
  type MonthData,
  type PersonIncome,
} from '../types'
import { ensureIncomeSlots, migrateLegacyIncome } from '../utils/incomeModel'
import { coerceUiPreferences } from '../utils/uiPrefs'
import { SEED_MONTHS } from '../data/seedMonths'
import { syncDocumentTheme } from '../theme/syncDocumentTheme'
import { readGreetingNameFromDevice, writeGreetingNameToDevice } from '../utils/greetingNameStorage'

function inferTag(name: string): ExpenseTag | undefined {
  const n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (/celular|iphone|samsung/.test(n)) return 'compras'
  if (/terapia|consulta|saude|medic|farmac|academia/.test(n)) return 'saude'
  if (/pos.?grad|faculdade|livro|escola/.test(n)) return 'educacao'
  if (/conselho|cbio|crea|oab|crc|crm/.test(n)) return 'trabalho'
  if (/apart|condomi|iptu|aluguel/.test(n)) return 'moradia'
  if (/\bluz\b|energia/.test(n)) return 'moradia'
  if (/internet/.test(n)) return 'moradia'
  if (/\btim\b|vivo|claro|\boi\b/.test(n)) return 'moradia'
  if (/seguro.?car|consorcio.?car|ipva|passagem/.test(n)) return 'transporte'
  if (/anuidade|cartao|multa|juros|tarifa|santander|itau|\bcaixa\b|\bbanco\b|\binter\b/.test(n)) return 'financeiro'
  if (/thermas|clube|netflix|spotify|cinema|show|viagem|assinatura/.test(n)) return 'lazer'
  if (/cabelo|unha|sobrancelha|roupa|cosmet/.test(n)) return 'compras'
  if (/juninho|pensao|ajuda|presente/.test(n)) return 'familia'
  if (/supermercado|restaurante|delivery|alimenta/.test(n)) return 'alimentacao'
  if (/invest|aplica|reserva|poupanca/.test(n)) return 'investimentos'
  return undefined
}

const INITIAL_TEMPLATES: ExpenseTemplate[] = [
  { id: 'tpl-apartamento',   name: 'Apartamento',        category: 'monthly',     tag: 'moradia' },
  { id: 'tpl-condominio',    name: 'Condomínio Nice',     category: 'monthly',     tag: 'moradia' },
  { id: 'tpl-seguro-carro',  name: 'Seguro carro',        category: 'monthly',     tag: 'transporte' },
  { id: 'tpl-luz',           name: 'Luz (Energia)',        category: 'monthly',     tag: 'moradia' },
  { id: 'tpl-internet',      name: 'Internet',            category: 'monthly',     tag: 'moradia' },
  { id: 'tpl-tim-pam',       name: 'Tim Pam',             category: 'monthly',     tag: 'moradia' },
  { id: 'tpl-tim-joses',     name: 'Tim Joses',           category: 'monthly',     tag: 'moradia' },
  { id: 'tpl-thermas',       name: 'Thermas Clube',        category: 'monthly',     tag: 'lazer' },
  { id: 'tpl-terapia',       name: 'Terapia',             category: 'monthly',     tag: 'saude' },
  { id: 'tpl-pos-grad',      name: 'Pós graduação',       category: 'monthly',     tag: 'educacao' },
  { id: 'tpl-consorcio',     name: 'Consórcio carro',     category: 'monthly',     tag: 'transporte' },
  { id: 'tpl-santander',     name: 'Cartão Santander',    category: 'credit_card', tag: 'financeiro' },
  { id: 'tpl-inter-cc',      name: 'Inter',               category: 'credit_card', tag: 'financeiro' },
  { id: 'tpl-inter-cel',     name: 'Banco Inter celular', category: 'credit_card', tag: 'compras' },
  { id: 'tpl-anuidade-itau', name: 'Anuidade Itaú',       category: 'others',      tag: 'financeiro' },
  { id: 'tpl-anuidade-cai',  name: 'Anuidade Caixa',      category: 'others',      tag: 'financeiro' },
  { id: 'tpl-corte-cabelo',  name: 'Corte cabelo',        category: 'others',      tag: 'compras' },
  { id: 'tpl-unha',          name: 'Unha e sobrancelha',  category: 'others',      tag: 'compras' },
  { id: 'tpl-iptu',          name: 'IPTU',                category: 'others',      tag: 'moradia' },
  { id: 'tpl-ipva',          name: 'IPVA',                category: 'others',      tag: 'transporte' },
  { id: 'tpl-passagem',      name: 'Passagem',            category: 'others',      tag: 'transporte' },
  { id: 'tpl-multa',         name: 'Multa',               category: 'others',      tag: 'financeiro' },
  { id: 'tpl-crbio',         name: 'Conselho CRBIO',      category: 'others',      tag: 'trabalho' },
  { id: 'tpl-juninho',       name: 'Juninho',             category: 'others',      tag: 'familia' },
]

// ── legacy exports kept for migration reference ─────────────────────────────
export const DEZ_2025_MONTH: MonthData = {
  id: 'dec-2025', month: 12, year: 2025,
  income: { p0: { salary: 17358, others: 1810 }, p1: { salary: 3864, others: 0 } },
  withdrawalPJ: 4, withdrawalReserve: 15,
  expenses: [
    { id: 'dec25-m1',  name: 'Apartamento',       value: 2874.27, consider: true,  status: 'ok',      category: 'monthly',     tag: 'moradia' },
    { id: 'dec25-m2',  name: 'Condomínio Nice',    value: 477.38,  consider: true,  status: 'ok',      category: 'monthly',     tag: 'moradia' },
    { id: 'dec25-m3',  name: 'Seguro carro',       value: 235.93,  consider: true,  status: 'ok',      category: 'monthly',     tag: 'transporte' },
    { id: 'dec25-m4',  name: 'Luz (Energia)',       value: 431.9,   consider: true,  status: 'ok',      category: 'monthly',     tag: 'moradia' },
    { id: 'dec25-m5',  name: 'Internet',           value: 109.46,  consider: true,  status: 'ok',      category: 'monthly',     tag: 'moradia' },
    { id: 'dec25-m6',  name: 'Tim Pam',            value: 67.12,   consider: true,  status: 'ok',      category: 'monthly',     tag: 'moradia' },
    { id: 'dec25-m7',  name: 'Tim Joses',          value: 66.09,   consider: true,  status: 'ok',      category: 'monthly',     tag: 'moradia' },
    { id: 'dec25-m8',  name: 'Thermas Clube',       value: 45.44,   consider: true,  status: 'ok',      category: 'monthly',     tag: 'lazer' },
    { id: 'dec25-m9',  name: 'Terapia',            value: 258.17,  consider: true,  status: 'ok',      category: 'monthly',     tag: 'saude' },
    { id: 'dec25-m10', name: 'Pós graduação',      value: 306.7,   consider: true,  status: 'ok',      category: 'monthly',     tag: 'educacao' },
    { id: 'dec25-m11', name: 'Consórcio carro',    value: 1182.41, consider: true,  status: 'ok',      category: 'monthly',     tag: 'transporte', installment: { current: 2, total: 84 } },
    { id: 'dec25-cc1', name: 'Cartão Santander',   value: 16131.0, consider: true,  status: 'ok',      category: 'credit_card', tag: 'financeiro' },
    { id: 'dec25-o1',  name: 'Anuidade Itaú',      value: 16.1,    consider: true,  status: 'ok',      category: 'others',      tag: 'financeiro' },
    { id: 'dec25-o2',  name: 'Corte cabelo',       value: 180.0,   consider: true,  status: 'ok',      category: 'others',      tag: 'compras' },
    { id: 'dec25-o3',  name: 'Unha e sobrancelha', value: 225.0,   consider: true,  status: 'ok',      category: 'others',      tag: 'compras' },
    { id: 'dec25-o4',  name: 'Anuidade Caixa',     value: 16.0,    consider: true,  status: 'ok',      category: 'others',      tag: 'financeiro' },
    { id: 'dec25-o5',  name: 'IPTU',               value: 248.72,  consider: true,  status: 'ok',      category: 'others',      tag: 'moradia' },
    { id: 'dec25-o6',  name: 'Revisar planilha',   value: 0,       consider: false, status: 'pending', category: 'others' },
    { id: 'dec25-o7',  name: 'Passagem',           value: 160.0,   consider: true,  status: 'ok',      category: 'others',      tag: 'transporte' },
  ],
}

export const JAN_2026_MONTH: MonthData = {
  id: 'jan-2026', month: 1, year: 2026,
  income: { p0: { salary: 17572, others: 1170.75 }, p1: { salary: 3922, others: 0 } },
  withdrawalPJ: 4, withdrawalReserve: 15,
  expenses: [
    { id: 'jan-m1',  name: 'Apartamento',       value: 2778.64, consider: true,  status: 'ok',      category: 'monthly',     tag: 'moradia' },
    { id: 'jan-m2',  name: 'Condomínio Nice',    value: 362.85,  consider: true,  status: 'ok',      category: 'monthly',     tag: 'moradia' },
    { id: 'jan-m3',  name: 'Seguro carro',       value: 228.16,  consider: true,  status: 'ok',      category: 'monthly',     tag: 'transporte' },
    { id: 'jan-m4',  name: 'Luz (Energia)',       value: 460.0,   consider: true,  status: 'ok',      category: 'monthly',     tag: 'moradia' },
    { id: 'jan-m5',  name: 'Internet',           value: 106.0,   consider: true,  status: 'ok',      category: 'monthly',     tag: 'moradia' },
    { id: 'jan-m6',  name: 'Tim Pam',            value: 65.0,    consider: true,  status: 'ok',      category: 'monthly',     tag: 'moradia' },
    { id: 'jan-m7',  name: 'Tim Joses',          value: 64.0,    consider: true,  status: 'ok',      category: 'monthly',     tag: 'moradia' },
    { id: 'jan-m8',  name: 'Thermas Clube',       value: 44.0,    consider: true,  status: 'ok',      category: 'monthly',     tag: 'lazer' },
    { id: 'jan-m9',  name: 'Pós graduação',      value: 297.0,   consider: true,  status: 'ok',      category: 'monthly',     tag: 'educacao' },
    { id: 'jan-m10', name: 'Consórcio carro',    value: 1145.0,  consider: true,  status: 'ok',      category: 'monthly',     tag: 'transporte', installment: { current: 3, total: 84 } },
    { id: 'jan-cc1', name: 'Cartão Santander',   value: 17160.97,consider: true,  status: 'ok',      category: 'credit_card', tag: 'financeiro' },
    { id: 'jan-o1',  name: 'Anuidade Itaú',      value: 16.1,    consider: true,  status: 'ok',      category: 'others',      tag: 'financeiro' },
    { id: 'jan-o2',  name: 'Unha e sobrancelha', value: 225.0,   consider: true,  status: 'ok',      category: 'others',      tag: 'compras' },
    { id: 'jan-o3',  name: 'Anuidade Caixa',     value: 16.0,    consider: true,  status: 'ok',      category: 'others',      tag: 'financeiro' },
    { id: 'jan-o4',  name: 'IPTU',               value: 161.25,  consider: true,  status: 'ok',      category: 'others',      tag: 'moradia' },
    { id: 'jan-o5',  name: 'Revisar planilha',   value: 0,       consider: false, status: 'pending', category: 'others' },
    { id: 'jan-o6',  name: 'Passagem',           value: 80.0,    consider: true,  status: 'ok',      category: 'others',      tag: 'transporte' },
    { id: 'jan-o7',  name: 'Conselho CRBIO',     value: 0,       consider: true,  status: 'pending', category: 'others',      tag: 'trabalho' },
  ],
}

// Apr 2026 is the most recent complete month from the imported Excel data
const CURRENT_MONTH_ID = 'b069f22b-b845-420b-b7fd-dc8a74be279f'

const migratingLocalStorage: StateStorage = {
  getItem(name) {
    let value = localStorage.getItem(name)
    if (value === null && name === PERSIST_STORAGE_KEY) {
      value = localStorage.getItem(LEGACY_PERSIST_STORAGE_KEY)
      if (value !== null) {
        try {
          localStorage.setItem(PERSIST_STORAGE_KEY, value)
        } catch {
          /* quota / privado */
        }
      }
    }
    return value
  },
  setItem(name, value) {
    localStorage.setItem(name, value)
  },
  removeItem(name) {
    localStorage.removeItem(name)
  },
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      months: SEED_MONTHS,
      currentMonthId: CURRENT_MONTH_ID,
      activeTab: 'planilha',
      ui: { ...DEFAULT_UI_PREFERENCES },
      templates: INITIAL_TEMPLATES.map(t => ({ ...t })),
      syncWorkspaceId: null,
      syncWorkspaceMeta: null,
      pendingJoinRequestId: null,

      setActiveTab: (tab: AppTab) => set({ activeTab: tab }),
      setSyncWorkspaceId: (id: string | null) =>
        set(
          id === null
            ? { syncWorkspaceId: null, syncWorkspaceMeta: null, pendingJoinRequestId: null }
            : { syncWorkspaceId: id }
        ),
      setSyncWorkspaceMeta: (meta: SyncWorkspaceMeta | null) => set({ syncWorkspaceMeta: meta }),
      setPendingJoinRequestId: (pendingJoinRequestId: string | null) => set({ pendingJoinRequestId }),

      setIncomeSlotCount: (count: number) =>
        set(state => {
          const n = Math.min(6, Math.max(1, Math.floor(count)))
          let labels = [...(state.ui.personLabels ?? DEFAULT_UI_PREFERENCES.personLabels)]
          while (labels.length < n) labels.push(`Pessoa ${labels.length + 1}`)
          if (labels.length > n) labels = labels.slice(0, n)
          return {
            ui: { ...state.ui, incomeSlotCount: n, personLabels: labels },
            months: state.months.map(m => ({
              ...m,
              income: ensureIncomeSlots(m.income, n),
            })),
          }
        }),

      completeOnboarding: ({ workspaceTitle, incomeSlotCount, personLabels }) =>
        set(state => {
          const n = Math.min(6, Math.max(1, Math.floor(incomeSlotCount)))
          let labels = personLabels.slice(0, n).map(s => s.trim() || 'Pessoa')
          while (labels.length < n) labels.push(`Pessoa ${labels.length + 1}`)
          return {
            ui: {
              ...state.ui,
              workspaceTitle: workspaceTitle.trim(),
              incomeSlotCount: n,
              personLabels: labels,
              onboardingDone: true,
            },
            months: state.months.map(m => ({
              ...m,
              income: ensureIncomeSlots(
                migrateLegacyIncome(m.income as Record<string, PersonIncome>),
                n
              ),
            })),
          }
        }),

      updateUi: partial =>
        set(state => {
          const prev = state.ui ?? DEFAULT_UI_PREFERENCES
          const ui = { ...prev, ...partial }
          if (typeof partial.theme !== 'undefined') syncDocumentTheme(partial.theme)
          if (typeof partial.greetingName !== 'undefined') {
            writeGreetingNameToDevice(ui.greetingName ?? '')
          }
          return { ui }
        }),

      setCurrentMonthId: (id: string) => set({ currentMonthId: id }),

      addMonth: (month: MonthData) =>
        set(state => ({
          months: [...state.months, month].sort((a, b) =>
            a.year !== b.year ? a.year - b.year : a.month - b.month
          ),
        })),

      updateMonthIncome: (monthId: string, income: Income) =>
        set(state => ({
          months: state.months.map(m => (m.id === monthId ? { ...m, income } : m)),
        })),

      updateWithdrawal: (monthId: string, pj: number, reserve: number) =>
        set(state => ({
          months: state.months.map(m =>
            m.id === monthId ? { ...m, withdrawalPJ: pj, withdrawalReserve: reserve } : m
          ),
        })),

      addExpense: (monthId: string, expense: Expense) =>
        set(state => ({
          months: state.months.map(m =>
            m.id === monthId ? { ...m, expenses: [...m.expenses, expense] } : m
          ),
        })),

      updateExpense: (monthId: string, expense: Expense) =>
        set(state => ({
          months: state.months.map(m =>
            m.id === monthId
              ? { ...m, expenses: m.expenses.map(e => (e.id === expense.id ? expense : e)) }
              : m
          ),
        })),

      deleteExpense: (monthId: string, expenseId: string) =>
        set(state => ({
          months: state.months.map(m =>
            m.id === monthId
              ? { ...m, expenses: m.expenses.filter(e => e.id !== expenseId) }
              : m
          ),
        })),

      addTemplate: (t: ExpenseTemplate) =>
        set(state => ({ templates: [...state.templates, t] })),

      updateTemplate: (t: ExpenseTemplate) =>
        set(state => ({
          templates: state.templates.map(x => (x.id === t.id ? t : x)),
          months: state.months.map(m => ({
            ...m,
            expenses: m.expenses.map(e =>
              e.templateId === t.id ? { ...e, name: t.name, tag: t.tag } : e
            ),
          })),
        })),

      deleteTemplate: (id: string) =>
        set(state => ({ templates: state.templates.filter(t => t.id !== id) })),

      getCurrentMonth: () => {
        const state = get()
        return state.months.find(m => m.id === state.currentMonthId)
      },
    }),
    {
      name: PERSIST_STORAGE_KEY,
      storage: createJSONStorage(() => migratingLocalStorage),
      version: 10,
      partialize: state => ({
        months: state.months,
        currentMonthId: state.currentMonthId,
        activeTab: state.activeTab,
        ui: state.ui,
        templates: state.templates,
        syncWorkspaceId: state.syncWorkspaceId,
        syncWorkspaceMeta: state.syncWorkspaceMeta,
        pendingJoinRequestId: state.pendingJoinRequestId,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) return
        const t = state?.ui?.theme ?? 'dark'
        syncDocumentTheme(t === 'light' ? 'light' : 'dark')
      },
      merge: (persistedState, currentState) => {
        if (persistedState == null) return currentState as AppState
        const p = persistedState as Partial<AppState>
        const cur = currentState as AppState
        const uiMerged = coerceUiPreferences({
          ...DEFAULT_UI_PREFERENCES,
          ...cur.ui,
          ...(p.ui ?? {}),
        } as Record<string, unknown>)
        const fromLs = readGreetingNameFromDevice()
        const ui =
          fromLs && !uiMerged.greetingName?.trim()
            ? { ...uiMerged, greetingName: fromLs }
            : !uiMerged.greetingName?.trim() && cur.ui?.greetingName?.trim()
              ? { ...uiMerged, greetingName: cur.ui.greetingName.trim() }
              : uiMerged
        return {
          ...cur,
          ...p,
          ui,
          syncWorkspaceId:
            p.syncWorkspaceId === undefined
              ? cur.syncWorkspaceId
              : typeof p.syncWorkspaceId === 'string' || p.syncWorkspaceId === null
                ? p.syncWorkspaceId
                : cur.syncWorkspaceId,
          syncWorkspaceMeta:
            p.syncWorkspaceMeta === undefined
              ? cur.syncWorkspaceMeta
              : p.syncWorkspaceMeta,
          pendingJoinRequestId:
            p.pendingJoinRequestId === undefined
              ? cur.pendingJoinRequestId
              : typeof p.pendingJoinRequestId === 'string' || p.pendingJoinRequestId === null
                ? p.pendingJoinRequestId
                : cur.pendingJoinRequestId,
          months: Array.isArray(p.months) && p.months.length > 0
            ? [...p.months].sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
            : cur.months,
          templates: Array.isArray(p.templates) && p.templates.length > 0
            ? p.templates
            : cur.templates,
        }
      },
      migrate: (persisted: unknown, fromVersion: number) => {
        if (persisted && typeof persisted === 'object') {
          const p = persisted as Record<string, unknown>
          if (fromVersion < 2 && typeof p.activeTab === 'string') {
            if (p.activeTab === 'dashboard' || p.activeTab === 'month') p.activeTab = 'planilha'
          }
          if (fromVersion < 3) {
            if (!p.ui || typeof p.ui !== 'object') {
              p.ui = { ...DEFAULT_UI_PREFERENCES }
            } else {
              const u = p.ui as Record<string, unknown>
              p.ui = {
                ...DEFAULT_UI_PREFERENCES,
                ...u,
                workspaceTitle: typeof u.workspaceTitle === 'string' ? u.workspaceTitle : '',
                person1Label: typeof u.person1Label === 'string' ? u.person1Label : 'Pessoa 1',
                person2Label: typeof u.person2Label === 'string' ? u.person2Label : 'Pessoa 2',
              }
            }
          }
          if (fromVersion < 4 && Array.isArray(p.months)) {
            const months = p.months as MonthData[]
            const hasJan = months.some(m => m?.id === 'jan-2026')
            if (!hasJan) {
              p.months = [...months, JSON.parse(JSON.stringify(JAN_2026_MONTH)) as MonthData].sort((a, b) =>
                a.year !== b.year ? a.year - b.year : a.month - b.month
              )
            }
          }
          if (fromVersion < 5 && Array.isArray(p.months)) {
            const months = p.months as MonthData[]
            const hasDec = months.some(m => m?.id === 'dec-2025')
            if (!hasDec) {
              p.months = [...months, JSON.parse(JSON.stringify(DEZ_2025_MONTH)) as MonthData].sort((a, b) =>
                a.year !== b.year ? a.year - b.year : a.month - b.month
              )
            }
          }
          if (fromVersion < 6 && Array.isArray(p.months)) {
            const months = p.months as MonthData[]
            p.months = months.map(m => ({
              ...m,
              expenses: (m.expenses ?? []).map((e: Expense) =>
                e.tag ? e : { ...e, tag: inferTag(e.name) }
              ),
            }))
          }
          if (fromVersion < 7) {
            if (!Array.isArray(p.templates) || (p.templates as unknown[]).length === 0) {
              p.templates = INITIAL_TEMPLATES.map(t => ({ ...t }))
            }
            if (Array.isArray(p.months)) {
              p.months = (p.months as MonthData[]).map(m => ({
                ...m,
                expenses: (m.expenses ?? []).map((e: Expense) =>
                  (e.status as string) === 'meeting' ? { ...e, status: 'pending' } : e
                ),
              }))
            }
          }
          if (fromVersion < 8) {
            // Replace all month data with the full Excel import (2020–2026)
            p.months = SEED_MONTHS.map(m => ({ ...m, expenses: m.expenses.map(e => ({ ...e })) }))
            p.currentMonthId = CURRENT_MONTH_ID
            if (!Array.isArray(p.templates) || (p.templates as unknown[]).length === 0) {
              p.templates = INITIAL_TEMPLATES.map(t => ({ ...t }))
            }
          }
          if (fromVersion < 9) {
            const u = (p.ui ?? {}) as Record<string, unknown>
            const personLabels: string[] = Array.isArray(u.personLabels) && (u.personLabels as unknown[]).length > 0
              ? (u.personLabels as unknown[]).map(String)
              : [
                  typeof u.person1Label === 'string' ? u.person1Label : 'Pessoa 1',
                  typeof u.person2Label === 'string' ? u.person2Label : 'Pessoa 2',
                ]
            let incomeSlotCount =
              typeof u.incomeSlotCount === 'number' && u.incomeSlotCount >= 1 && u.incomeSlotCount <= 6
                ? u.incomeSlotCount
                : Math.min(6, Math.max(1, personLabels.length))
            let labels = [...personLabels]
            while (labels.length < incomeSlotCount) labels.push(`Pessoa ${labels.length + 1}`)
            if (labels.length > incomeSlotCount) labels = labels.slice(0, incomeSlotCount)
            incomeSlotCount = labels.length
            const fontSize = u.fontSize === 'sm' || u.fontSize === 'md' || u.fontSize === 'lg' ? u.fontSize : 'md'
            const theme = u.theme === 'light' || u.theme === 'dark' ? u.theme : 'dark'
            p.ui = {
              workspaceTitle: typeof u.workspaceTitle === 'string' ? u.workspaceTitle : '',
              personLabels: labels,
              incomeSlotCount,
              onboardingDone: true,
              fontSize,
              theme,
            }
            if (Array.isArray(p.months)) {
              p.months = (p.months as MonthData[]).map(m => ({
                ...m,
                income: ensureIncomeSlots(
                  migrateLegacyIncome(m.income as Record<string, PersonIncome>),
                  incomeSlotCount
                ),
              }              ))
            }
          }
          if (fromVersion < 10) {
            p.syncWorkspaceId = null
            p.syncWorkspaceMeta = null
            p.pendingJoinRequestId = null
          }
        }
        return persisted
      },
    }
  )
)
