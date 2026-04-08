export type ExpenseCategory = 'monthly' | 'credit_card' | 'others'
export type ExpenseStatus = 'ok' | 'pending' | null
export type ExpenseTag =
  | 'moradia'
  | 'alimentacao'
  | 'transporte'
  | 'trabalho'
  | 'saude'
  | 'lazer'
  | 'compras'
  | 'educacao'
  | 'financeiro'
  | 'investimentos'
  | 'familia'
  | 'outros'

export interface ExpenseTemplate {
  id: string
  name: string
  category: ExpenseCategory
  tag?: ExpenseTag
}

export interface Installment {
  current: number
  total: number
}

export interface Expense {
  id: string
  name: string
  value: number
  consider: boolean
  status: ExpenseStatus
  category: ExpenseCategory
  tag?: ExpenseTag
  templateId?: string
  installment?: Installment
}

export interface PersonIncome {
  salary: number
  others: number
}

/** Renda por pessoa: chaves `p0`…`p5` (quantas usadas depende de `ui.incomeSlotCount`). */
export type Income = Record<string, PersonIncome>

export interface MonthData {
  id: string
  month: number
  year: number
  expenses: Expense[]
  income: Income
  withdrawalPJ: number
  withdrawalReserve: number
}

export type AppTab = 'planilha' | 'metrics' | 'history' | 'items' | 'settings'
export type FontSize = 'sm' | 'md' | 'lg'
export type AppTheme = 'dark' | 'light'

export interface UiPreferences {
  workspaceTitle: string
  /** Nome exibido por coluna de renda (comprimento = `incomeSlotCount`). */
  personLabels: string[]
  /** Quantas pessoas/colunas de renda (1–6). */
  incomeSlotCount: number
  /** Após o primeiro acesso (landing), não exibir wizard de configuração. */
  onboardingDone: boolean
  /** Nome para saudação após o login (persiste com os dados da app). */
  greetingName: string
  fontSize: FontSize
  theme: AppTheme
}

/** ACL do documento `workspaces/*` na nuvem (email verificado). */
export interface SyncWorkspaceMeta {
  ownerEmail: string
  allowedEmails: string[]
}

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  workspaceTitle: '',
  personLabels: ['Pessoa 1', 'Pessoa 2'],
  incomeSlotCount: 2,
  onboardingDone: false,
  greetingName: '',
  fontSize: 'md',
  theme: 'dark',
}

export interface AppState {
  months: MonthData[]
  currentMonthId: string
  activeTab: AppTab
  ui: UiPreferences
  templates: ExpenseTemplate[]
  /** ID do documento em `workspaces/{id}` na nuvem. */
  syncWorkspaceId: string | null
  /** Titular e emails autorizados (espelha o Firestore). */
  syncWorkspaceMeta: SyncWorkspaceMeta | null
  /** Convidado à espera de aprovação do titular. */
  pendingJoinRequestId: string | null

  setActiveTab: (tab: AppTab) => void
  setSyncWorkspaceId: (id: string | null) => void
  setSyncWorkspaceMeta: (meta: SyncWorkspaceMeta | null) => void
  setPendingJoinRequestId: (id: string | null) => void
  /** Ajusta quantas colunas de renda existem e garante chaves `p*` em todos os meses. */
  setIncomeSlotCount: (count: number) => void
  /** Primeiro acesso: quantidade de pessoas na renda, nomes e título. */
  completeOnboarding: (payload: { workspaceTitle: string; incomeSlotCount: number; personLabels: string[] }) => void
  updateUi: (partial: Partial<UiPreferences>) => void
  setCurrentMonthId: (id: string) => void
  addMonth: (month: MonthData) => void
  updateMonthIncome: (monthId: string, income: Income) => void
  updateWithdrawal: (monthId: string, pj: number, reserve: number) => void
  addExpense: (monthId: string, expense: Expense) => void
  updateExpense: (monthId: string, expense: Expense) => void
  deleteExpense: (monthId: string, expenseId: string) => void
  getCurrentMonth: () => MonthData | undefined
  addTemplate: (t: ExpenseTemplate) => void
  updateTemplate: (t: ExpenseTemplate) => void
  deleteTemplate: (id: string) => void
}
