import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, ChevronDown, ChevronRight, History, List, Moon, Pencil, Plus, Settings, Sheet, Sun, Trash2, X } from 'lucide-react'
import { useStore } from './store'
import {
  DEFAULT_UI_PREFERENCES,
  type AppTab,
  type AppTheme,
  type Expense,
  type ExpenseCategory,
  type ExpenseStatus,
  type ExpenseTag,
  type ExpenseTemplate,
  type FontSize,
} from './types'
import {
  getAmountPaid,
  getAmountPending,
  getCategoryExpenses,
  getLiquidoAtual,
  getLiquidoPrevisto,
  getNetBalance,
  getPaymentProgress,
  getTotalExpenses,
  getTotalIncome,
} from './utils/calculations'
import { incomeKeysForCount } from './utils/incomeModel'
import {
  formatCurrency,
  formatMoneyForInput,
  formatMonthYear,
  parseMoneyInput,
} from './utils/format'
import { CloudAccessPanel } from './components/CloudAccessPanel'
import { MetricsTab } from './components/MetricsTab'
import { RemoteSyncBridge } from './sync/RemoteSyncBridge'
import { isFirebaseConfigured } from './sync/firebaseApp'
import { useSyncUiStore } from './sync/syncUiStore'
import { emptyIncomeTemplate, ensureIncomeSlots, migrateLegacyIncome } from './utils/incomeModel'

// ─── constants ────────────────────────────────────────────────────────────────

const CATEGORY_ORDER: ExpenseCategory[] = ['monthly', 'credit_card', 'others']

const SECTION_META: Record<ExpenseCategory, { title: string; headerClass: string; totalClass: string }> = {
  monthly:     { title: 'CUSTO MENSAL',      headerClass: 'bg-[#3B4CCA] text-white',    totalClass: 'bg-[#5B4FC9] text-white font-semibold' },
  credit_card: { title: 'CARTÃO DE CRÉDITO', headerClass: 'bg-[#0D9488] text-white',    totalClass: 'bg-[#7F1D1D] text-white font-semibold' },
  others:      { title: 'OUTROS',            headerClass: 'bg-[#CA8A04] text-[#1a1400]', totalClass: 'bg-[#A16207] text-white font-semibold' },
}

const TAB_CONFIG: { id: AppTab; label: string; icon: typeof Sheet }[] = [
  { id: 'planilha', label: 'Planilha',  icon: Sheet },
  { id: 'metrics',  label: 'Métricas', icon: BarChart3 },
  { id: 'history',  label: 'Histórico', icon: History },
  { id: 'items',    label: 'Itens',     icon: List },
  { id: 'settings', label: 'Ajustes',  icon: Settings },
]

export const EXPENSE_TAGS: Record<ExpenseTag, { emoji: string; label: string }> = {
  moradia:       { emoji: '🏠', label: 'Moradia' },
  alimentacao:   { emoji: '🍔', label: 'Alimentação' },
  transporte:    { emoji: '🚗', label: 'Transporte' },
  trabalho:      { emoji: '💼', label: 'Trabalho' },
  saude:         { emoji: '💊', label: 'Saúde' },
  lazer:         { emoji: '🎉', label: 'Lazer' },
  compras:       { emoji: '🛍️', label: 'Compras' },
  educacao:      { emoji: '📚', label: 'Educação' },
  financeiro:    { emoji: '💳', label: 'Financeiro' },
  investimentos: { emoji: '💰', label: 'Investimentos' },
  familia:       { emoji: '🧑‍🤝‍🧑', label: 'Família' },
  outros:        { emoji: '🐾', label: 'Outros' },
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function nextStatus(s: ExpenseStatus): ExpenseStatus {
  return s === 'ok' ? 'pending' : 'ok'
}

function statusShort(status: ExpenseStatus): string {
  return status === 'ok' ? 'Ok' : 'Pend.'
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `exp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const months          = useStore(s => s.months)
  const sortedMonths    = useMemo(() => [...months].sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month), [months])
  const currentMonthId  = useStore(s => s.currentMonthId)
  const activeTab       = useStore(s => s.activeTab)
  const setActiveTab    = useStore(s => s.setActiveTab)
  const setCurrentMonthId = useStore(s => s.setCurrentMonthId)
  const getCurrentMonth = useStore(s => s.getCurrentMonth)
  const updateExpense   = useStore(s => s.updateExpense)

  const updateMonthIncome = useStore(s => s.updateMonthIncome)
  const addMonth        = useStore(s => s.addMonth)
  const addExpense      = useStore(s => s.addExpense)
  const deleteExpense   = useStore(s => s.deleteExpense)
  const ui              = useStore(s => s.ui) ?? DEFAULT_UI_PREFERENCES
  const updateUi        = useStore(s => s.updateUi)
  const templates       = useStore(s => s.templates)
  const addTemplate     = useStore(s => s.addTemplate)
  const updateTemplate  = useStore(s => s.updateTemplate)
  const deleteTemplate  = useStore(s => s.deleteTemplate)
  const syncWorkspaceId = useStore(s => s.syncWorkspaceId)
  const setSyncWorkspaceId = useStore(s => s.setSyncWorkspaceId)
  const setIncomeSlotCount = useStore(s => s.setIncomeSlotCount)
  const syncUiKind = useSyncUiStore(s => s.kind)
  const syncUiMessage = useSyncUiStore(s => s.message)
  const syncLastAt = useSyncUiStore(s => s.lastAt)
  const fontSize: FontSize = ui.fontSize ?? 'md'
  const theme: AppTheme   = ui.theme ?? 'dark'

  useEffect(() => {
    const map: Record<FontSize, string> = { sm: '14px', md: '16px', lg: '18px' }
    document.documentElement.style.fontSize = map[fontSize]
    return () => { document.documentElement.style.fontSize = '' }
  }, [fontSize])

  const [rendaExpanded, setRendaExpanded] = useState(true)
  const [addingFor, setAddingFor] = useState<ExpenseCategory | null>(null)
  const [showNewMonth, setShowNewMonth] = useState(false)

  const month = getCurrentMonth()
  if (!month) {
    return <div className="flex min-h-screen items-center justify-center p-6 text-muted">Nenhum mês selecionado.</div>
  }

  const incomeSlotCount = ui.incomeSlotCount ?? 2
  const incomeTotal     = getTotalIncome(month, incomeSlotCount)
  const debitForecast   = getTotalExpenses(month)
  const liquidoPrevisto = getLiquidoPrevisto(month, incomeSlotCount)
  const liquidoAtual    = getLiquidoAtual(month, incomeSlotCount)

  const progress        = getPaymentProgress(month)
  const headerSubtitle  = ui.workspaceTitle.trim() || 'Planize'

  const handleAddLine = useCallback((category: ExpenseCategory) => { setAddingFor(category) }, [])

  const handleAddFromTemplate = useCallback((tpl: ExpenseTemplate) => {
    addExpense(month.id, { id: newId(), name: tpl.name, value: 0, consider: true, status: 'pending', category: tpl.category, tag: tpl.tag, templateId: tpl.id })
    setAddingFor(null)
  }, [addExpense, month.id])

  const handleAddBlank = useCallback((category: ExpenseCategory) => {
    addExpense(month.id, { id: newId(), name: '', value: 0, consider: true, status: 'pending', category })
    setAddingFor(null)
  }, [addExpense, month.id])

  return (
    <div className="app-viewport font-sans">
      <RemoteSyncBridge />
      <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col pb-[max(8.5rem,calc(6.25rem+env(safe-area-inset-bottom)))]">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-border bg-bg/95 px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1 truncate text-[0.625rem] font-medium uppercase tracking-wide text-muted">
              <span className="truncate">{headerSubtitle}</span>
              {syncWorkspaceId && syncUiKind === 'synced' ? (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 light:bg-emerald-600" title="Nuvem sincronizada" />
              ) : null}
              {syncWorkspaceId && syncUiKind === 'connecting' ? (
                <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400" title="Conectando…" />
              ) : null}
              {syncWorkspaceId && syncUiKind === 'error' ? (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" title={syncUiMessage ?? 'Erro de sync'} />
              ) : null}
            </p>
            <h1 className="hidden truncate text-base font-bold tracking-tight text-textMain sm:block sm:text-xl">
              {formatMonthYear(month.month, month.year)}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <select
              value={currentMonthId}
              onChange={e => setCurrentMonthId(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-textMain outline-none ring-primary focus:ring-2"
            >
              {sortedMonths.map(m => (
                <option key={m.id} value={m.id}>{formatMonthYear(m.month, m.year)}</option>
              ))}
            </select>
            <button type="button" onClick={() => setShowNewMonth(true)}
              className="flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-card active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Novo mês</span>
            </button>
            <button
              type="button"
              onClick={() => updateUi({ theme: theme === 'dark' ? 'light' : 'dark' })}
              title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition hover:bg-card hover:text-textMain active:scale-95"
            >
              {theme === 'dark'
                ? <Moon className="h-4 w-4" />
                : <Sun className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-2 py-3 sm:px-4">

        {/* ── Planilha ── */}
        {activeTab === 'planilha' && (
          <div className="animate-fade-in space-y-3">

            {/* Tabela única — colunas em % no mobile para caber sem rolagem horizontal */}
            <div className="overflow-x-auto overscroll-x-contain rounded-lg border border-border shadow-sm">
              <table className="w-full min-w-0 table-fixed border-collapse text-left text-[0.6875rem] sm:text-sm">
                <colgroup>
                  <col className="w-[32%] sm:w-[8.5rem]" />
                  <col className="w-[22%] sm:w-[104px]" />
                  <col className="w-[22%] sm:w-[100px]" />
                  <col className="w-[18%] sm:w-[86px]" />
                  <col className="w-[6%] sm:w-9" />
                </colgroup>
                <thead>
                  <tr className="bg-card text-[0.5625rem] uppercase tracking-wide text-muted sm:text-[0.625rem]">
                    <th className="border-b border-border px-1.5 py-1.5 font-medium sm:px-2 sm:py-2">Item</th>
                    <th className="border-b border-border px-1 py-1.5 text-right font-medium sm:py-2">Valor</th>
                    <th className="border-b border-border px-0.5 py-1.5 text-center font-medium sm:py-2">Considerar</th>
                    <th className="border-b border-border px-0.5 py-1.5 text-center font-medium sm:py-2">Situação</th>
                    <th className="border-b border-border px-0 py-1.5 sm:py-2" />
                  </tr>
                </thead>
                {CATEGORY_ORDER.map(cat => {
                  const meta = SECTION_META[cat]
                  const rows = getCategoryExpenses(month.expenses, cat)
                  /** Soma igual às linhas visíveis da secção (Sim e Não em considerar). */
                  const totalAll = rows.reduce((sum, e) => sum + (Number(e.value) || 0), 0)
                  return (
                    <tbody key={cat}>
                      <tr>
                        <td colSpan={5} className={`px-1.5 py-1 text-[0.625rem] font-bold tracking-wide sm:px-3 sm:py-2 sm:text-xs ${meta.headerClass}`}>{meta.title}</td>
                      </tr>
                      {rows.map(exp => (
                        <ExpenseRow key={exp.id} monthId={month.id} expense={exp} updateExpense={updateExpense} deleteExpense={deleteExpense} />
                      ))}
                      <tr>
                        <td colSpan={5} className="border-t border-border px-2 py-1 sm:px-3 sm:py-1.5">
                          <button type="button" onClick={() => handleAddLine(cat)}
                            className="w-full rounded border border-dashed border-border py-1.5 text-[0.65rem] font-medium text-slate-400 transition hover:border-primary/50 hover:text-primary sm:py-2 sm:text-xs light:text-slate-600"
                          >
                            + linha em {meta.title.replace('CUSTO MENSAL', 'custos').replace('CARTÃO DE CRÉDITO', 'cartão').replace('OUTROS', 'outros')}
                          </button>
                        </td>
                      </tr>
                      <tr className={`${meta.totalClass} text-[0.6875rem] sm:text-sm`}>
                        <td className="px-1.5 py-1 sm:px-3 sm:py-2">Total</td>
                        <td className="px-1.5 py-1 text-right tabular-nums font-bold sm:px-3 sm:py-2">{formatCurrency(totalAll)}</td>
                        <td colSpan={3} />
                      </tr>
                    </tbody>
                  )
                })}
              </table>
            </div>

            {/* Progresso — antes do resumo Débitos / Líq. */}
            <div className="rounded-xl border border-border bg-surface px-3 py-2 sm:px-4 sm:py-3">
              <div className="flex items-center justify-between">
                <span className="text-[0.6875rem] font-semibold text-muted sm:text-xs">Pagamentos</span>
                <span className="text-[0.6875rem] font-bold tabular-nums text-textMain sm:text-xs">{progress.paid}/{progress.total} · {Math.round(progress.percentage)}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-card sm:mt-2 sm:h-2">
                <div className={`h-full rounded-full transition-all ${
                  progress.percentage >= 100 ? 'bg-emerald-500 light:bg-emerald-600' :
                  progress.percentage >= 60  ? 'bg-amber-400 light:bg-amber-500' :
                  progress.percentage >= 25  ? 'bg-orange-500 light:bg-orange-600' :
                  'bg-red-600 light:bg-red-600'
                }`} style={{ width: `${Math.min(100, progress.percentage)}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[0.625rem] text-slate-400 sm:mt-2 sm:text-[0.6875rem] light:text-slate-600">
                <span>Pago {formatCurrency(getAmountPaid(month))}</span>
                <span>Pendente {formatCurrency(getAmountPending(month))}</span>
              </div>
            </div>

            {/* Resumo (Débitos / Líq. previsto / Líq. atual, antes da renda) */}
            <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
              <SummaryPill label="Débitos" value={formatCurrency(debitForecast)} className="text-white bg-orange-900 light:bg-orange-700" />
              <SummaryPill label="Liq. previsto" value={formatCurrency(liquidoPrevisto)} className={liquidoPrevisto >= 0 ? 'bg-violet-800 text-white light:bg-violet-700' : 'bg-red-800 text-white light:bg-red-600'} />
              <SummaryPill label="Liq. atual" value={formatCurrency(liquidoAtual)} className={liquidoAtual >= 0 ? 'bg-emerald-800 text-white light:bg-emerald-600' : 'bg-red-700 text-white light:bg-red-600'} />
            </div>

            {/* Renda e retiradas */}
            <div className="rounded-lg border border-border bg-card">
              <button type="button" onClick={() => setRendaExpanded(p => !p)}
                className="flex w-full items-center gap-2 px-3 py-3 sm:cursor-default"
              >
                <span className="flex-1 text-xs font-bold uppercase tracking-wide text-muted">Renda</span>
                <span className="tabular-nums text-sm font-bold text-textMain">{formatCurrency(incomeTotal)}</span>
                <span className="sm:hidden">
                  {rendaExpanded ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />}
                </span>
              </button>
              <div className={`px-3 pb-3 sm:block ${rendaExpanded ? 'block' : 'hidden'}`}>
                <div className={`grid gap-3 ${incomeSlotCount <= 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
                  {incomeKeysForCount(incomeSlotCount).map((key, i) => {
                    const label = ui.personLabels[i] ?? `Pessoa ${i + 1}`
                    const row = month.income[key] ?? { salary: 0, others: 0 }
                    return (
                      <IncomeFields
                        key={key}
                        label={label}
                        salary={row.salary}
                        others={row.others}
                        onChangeSalary={val =>
                          updateMonthIncome(month.id, { ...month.income, [key]: { ...row, salary: val } })}
                        onChangeOthers={val =>
                          updateMonthIncome(month.id, { ...month.income, [key]: { ...row, others: val } })}
                      />
                    )
                  })}
                  <div className="col-span-full sm:col-span-2 lg:col-span-3">
                    <p className="text-[0.6875rem] text-muted">Renda total</p>
                    <p className="text-lg font-bold tabular-nums text-textMain">{formatCurrency(incomeTotal)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Métricas ── */}
        {activeTab === 'metrics' && (
          <MetricsTab
            months={months}
            currentMonth={month}
            incomeSlotCount={incomeSlotCount}
            onNavigateMonth={(id) => { setCurrentMonthId(id); setActiveTab('planilha') }}
          />
        )}

        {/* ── Histórico ── */}
        {activeTab === 'history' && (
          <ul className="space-y-3 animate-fade-in">
            {months.map(m => {
              const inc = getTotalIncome(m, incomeSlotCount)
              const exp = getTotalExpenses(m)
              const bal = getNetBalance(m, incomeSlotCount)
              return (
                <li key={m.id}>
                  <button type="button"
                    onClick={() => { setCurrentMonthId(m.id); setActiveTab('planilha') }}
                    className="w-full rounded-xl border border-border bg-surface p-4 text-left transition hover:bg-card"
                  >
                    <p className="font-medium text-textMain">{formatMonthYear(m.month, m.year)}</p>
                    <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted sm:grid-cols-3">
                      <span>Renda {formatCurrency(inc)}</span>
                      <span>Débitos {formatCurrency(exp)}</span>
                      <span className={bal >= 0 ? 'text-success' : 'text-danger'}>Líquido {formatCurrency(bal)}</span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {/* ── Itens ── */}
        {activeTab === 'items' && (
          <ItemsTab templates={templates} addTemplate={addTemplate} updateTemplate={updateTemplate} deleteTemplate={deleteTemplate} />
        )}

        {/* ── Ajustes ── */}
        {activeTab === 'settings' && (
          <div className="animate-fade-in space-y-4 px-1">
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-textMain">Tamanho da fonte</h2>
              <p className="mt-1 text-xs text-muted">Ajusta o texto em todas as telas do app.</p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-xs text-muted">Menor</span>
                <div className="flex flex-1 gap-2">
                  {(['sm', 'md', 'lg'] as FontSize[]).map((size, i) => {
                    const textSizes = ['text-sm', 'text-base', 'text-xl']
                    const names = ['Pequeno', 'Médio', 'Grande']
                    const isActive = fontSize === size
                    return (
                      <button key={size} type="button" onClick={() => updateUi({ fontSize: size })}
                        className={`flex flex-1 flex-col items-center gap-1 rounded-xl border py-3 transition active:scale-95 ${isActive ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted'}`}
                      >
                        <span className={`font-bold leading-none ${textSizes[i]}`}>A</span>
                        <span className="text-[0.625rem] font-medium">{names[i]}</span>
                      </button>
                    )
                  })}
                </div>
                <span className="text-xs text-muted">Maior</span>
              </div>
            </section>
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-textMain">Personalização</h2>
              <p className="mt-1 text-xs text-muted">Título, quantidade de colunas de renda e o nome de cada uma.</p>
              <label className="mt-4 block text-xs text-muted">
                Título (acima do mês)
                <input type="text" value={ui.workspaceTitle} onChange={e => updateUi({ workspaceTitle: e.target.value })}
                  placeholder="Ex.: Casa"
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textMain outline-none ring-primary placeholder:text-muted/50 focus:ring-2"
                />
              </label>
              <label className="mt-3 block text-xs text-muted">
                Pessoas na renda (colunas)
                <select
                  value={incomeSlotCount}
                  onChange={e => setIncomeSlotCount(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textMain outline-none ring-primary focus:ring-2"
                >
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'pessoa' : 'pessoas'}</option>
                  ))}
                </select>
              </label>
              <div className="mt-3 space-y-2">
                <p className="text-xs text-muted">Nomes nas colunas</p>
                {incomeKeysForCount(incomeSlotCount).map((_, i) => (
                  <label key={i} className="block text-xs text-muted">
                    Coluna {i + 1}
                    <input
                      type="text"
                      value={ui.personLabels[i] ?? ''}
                      onChange={e => {
                        const next = [...(ui.personLabels ?? [])]
                        next[i] = e.target.value
                        updateUi({ personLabels: next })
                      }}
                      className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textMain outline-none ring-primary focus:ring-2"
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-textMain">Sincronização na nuvem</h2>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                Todos usam o mesmo serviço na nuvem (não precisa de configurar Firebase no telemóvel). Convites por
                email: o titular envia, entra pelo link e toca em <strong className="text-textMain">Ativar na nuvem</strong>;
                os convidados entram pelo link e o titular aprova no aviso no topo.
              </p>
              <CloudAccessPanel />
              {syncWorkspaceId ? (
                <div className="mt-4 space-y-2 border-t border-border pt-4">
                  {syncUiKind === 'synced' && syncLastAt != null && (
                    <p className="text-[0.625rem] text-muted">Última sincronização: {new Date(syncLastAt).toLocaleString('pt-BR')}</p>
                  )}
                  {syncUiKind === 'error' && syncUiMessage && (
                    <p className="text-xs font-medium text-red-400 light:text-red-700">{syncUiMessage}</p>
                  )}
                  {syncUiKind === 'connecting' && (
                    <p className="text-xs text-muted">A ligar à nuvem…</p>
                  )}
                </div>
              ) : null}
            </section>

            <p className="text-center text-xs text-muted">
              {syncWorkspaceId && isFirebaseConfigured()
                ? 'Dados na nuvem (tempo real) e cópia local neste aparelho.'
                : 'Sem nuvem ativa, os dados ficam só neste aparelho.'}
            </p>

            <p className="mt-4 text-center font-mono text-[0.5625rem] leading-relaxed text-muted/60">
              Interface {__BUILD_STAMP__}
              {import.meta.env.DEV ? ' · dev' : ''}
            </p>
          </div>
        )}
      </main>

      {/* ── Nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-bg/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur">
        <div className="mx-auto flex max-w-3xl justify-around">
          {TAB_CONFIG.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setActiveTab(id)}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[0.5625rem] font-medium transition sm:text-xs ${activeTab === id ? 'text-primary' : 'text-muted hover:text-textMain'}`}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={activeTab === id ? 2.25 : 1.75} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Template Picker ── */}
      {addingFor && (
        <TemplatePicker
          category={addingFor}
          templates={templates}
          onSelect={handleAddFromTemplate}
          onBlank={() => handleAddBlank(addingFor)}
          onClose={() => setAddingFor(null)}
        />
      )}

      {showNewMonth && (
        <NewMonthModal
          sortedMonths={sortedMonths}
          onConfirm={(newMonth) => {
            addMonth(newMonth)
            setCurrentMonthId(newMonth.id)
            setActiveTab('planilha')
            setShowNewMonth(false)
          }}
          onClose={() => setShowNewMonth(false)}
        />
      )}
      </div>
    </div>
  )
}

// ─── NewMonthModal ─────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function NewMonthModal({ sortedMonths, onConfirm, onClose }: {
  sortedMonths: import('./types').MonthData[]
  onConfirm: (m: import('./types').MonthData) => void
  onClose: () => void
}) {
  const incomeSlotCount = useStore(s => s.ui.incomeSlotCount)
  const now = new Date()
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)
  const [selYear, setSelYear]   = useState(now.getFullYear())
  const [sourceId, setSourceId] = useState(sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1].id : '')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  const sourceMonth = sortedMonths.find(m => m.id === sourceId)
  const alreadyExists = sortedMonths.some(m => m.month === selMonth && m.year === selYear)

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i)

  const toggleExclude = (id: string) => setExcluded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const handleConfirm = () => {
    const id = `${String(selMonth).padStart(2,'0')}-${selYear}`
    const baseExpenses: Expense[] = sourceMonth
      ? sourceMonth.expenses
          .filter(e => !excluded.has(e.id))
          .map(e => ({ ...e, id: newId(), status: null, consider: true,
            installment: e.installment ? { ...e.installment, current: e.installment.current + 1 } : undefined,
          }))
      : []
    const baseIncome = sourceMonth
      ? ensureIncomeSlots(migrateLegacyIncome(sourceMonth.income), incomeSlotCount)
      : emptyIncomeTemplate(incomeSlotCount)
    onConfirm({ id, month: selMonth, year: selYear, expenses: baseExpenses, income: baseIncome, withdrawalPJ: 0, withdrawalReserve: 0 })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="rounded-t-2xl bg-bg border-t border-border flex flex-col max-h-[90dvh]" onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1"><div className="h-1 w-10 rounded-full bg-border" /></div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-bold text-textMain">Novo mês</span>
          <button onClick={onClose}><X className="h-5 w-5 text-muted" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          {/* Seleção mês/ano */}
          <div>
            <p className="text-xs font-semibold text-muted mb-2">Mês e ano</p>
            <div className="grid grid-cols-2 gap-2">
              <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-textMain outline-none"
              >
                {MONTH_NAMES.map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
              </select>
              <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-textMain outline-none"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {alreadyExists && <p className="mt-1.5 text-xs font-medium text-red-400 light:text-red-700">Este mês já existe.</p>}
          </div>

          {/* Fonte */}
          <div>
            <p className="text-xs font-semibold text-muted mb-2">Copiar despesas de</p>
            <select value={sourceId} onChange={e => { setSourceId(e.target.value); setExcluded(new Set()) }}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-textMain outline-none"
            >
              <option value="">Mês em branco</option>
              {sortedMonths.map(m => (
                <option key={m.id} value={m.id}>{formatMonthYear(m.month, m.year)}</option>
              ))}
            </select>
          </div>

          {/* Lista de despesas para desmarcar */}
          {sourceMonth && (
            <div>
              <p className="text-xs font-semibold text-muted mb-2">Desmarque itens que não se repetem</p>
              <div className="space-y-1">
                {sourceMonth.expenses.map(e => {
                  const isOut = excluded.has(e.id)
                  return (
                    <button key={e.id} type="button" onClick={() => toggleExclude(e.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98] ${isOut ? 'opacity-50' : 'bg-surface'}`}
                      style={isOut ? { background: 'var(--row-ignore)' } : undefined}
                    >
                      <div className={`h-4 w-4 shrink-0 rounded border-2 transition ${isOut ? 'border-red-500 bg-transparent light:border-red-600' : 'border-emerald-500 bg-emerald-500 light:border-emerald-600 light:bg-emerald-600'}`} />
                      <span className={`flex-1 text-sm ${isOut ? 'text-muted line-through' : 'text-textMain'}`}>{e.name || '(sem nome)'}</span>
                      <span className="text-xs text-muted tabular-nums">{SECTION_META[e.category].title.split(' ')[0]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 border-t border-border">
          <button type="button" onClick={handleConfirm} disabled={alreadyExists}
            className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white transition active:scale-95 disabled:opacity-40"
          >
            Criar {MONTH_NAMES[selMonth - 1]} {selYear}
            {sourceMonth && ` (${sourceMonth.expenses.length - excluded.size} itens)`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SummaryPill({ label, value, className, style }: { label: string; value: string; className: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-lg px-1.5 py-1.5 shadow-sm sm:px-3 sm:py-3 ${className}`} style={style}>
      <p className="text-[0.5rem] font-semibold uppercase leading-tight opacity-90 sm:text-[0.625rem]">{label}</p>
      <p className="mt-0.5 truncate text-[0.6875rem] font-bold tabular-nums sm:text-base">{value}</p>
    </div>
  )
}

function IncomeFields({ label, salary, others, onChangeSalary, onChangeOthers }: {
  label: string
  salary: number
  others: number
  onChangeSalary: (v: number) => void
  onChangeOthers: (v: number) => void
}) {
  const [salaryDraft, setSalaryDraft] = useState(formatMoneyForInput(salary))
  const [othersDraft, setOthersDraft] = useState(formatMoneyForInput(others))

  useEffect(() => { setSalaryDraft(formatMoneyForInput(salary)) }, [salary])
  useEffect(() => { setOthersDraft(formatMoneyForInput(others)) }, [others])

  const commitSalary = () => { const v = parseMoneyInput(salaryDraft); onChangeSalary(v); setSalaryDraft(formatMoneyForInput(v)) }
  const commitOthers = () => { const v = parseMoneyInput(othersDraft); onChangeOthers(v); setOthersDraft(formatMoneyForInput(v)) }

  return (
    <div className="space-y-2 rounded-md bg-surface/80 p-2">
      <p className="text-[0.6875rem] font-semibold text-primary">{label}</p>
      <label className="block text-[0.6875rem] text-muted">
        Salário líquido
        <input type="text" inputMode="decimal" value={salaryDraft}
          onChange={e => setSalaryDraft(e.target.value)}
          onBlur={commitSalary} onFocus={e => e.target.select()}
          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="mt-1 w-full rounded border border-border bg-bg px-2 py-1.5 text-sm tabular-nums text-textMain outline-none ring-primary focus:ring-2"
        />
      </label>
      <label className="block text-[0.6875rem] text-muted">
        Outros
        <input type="text" inputMode="decimal" value={othersDraft}
          onChange={e => setOthersDraft(e.target.value)}
          onBlur={commitOthers} onFocus={e => e.target.select()}
          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="mt-1 w-full rounded border border-border bg-bg px-2 py-1.5 text-sm tabular-nums text-textMain outline-none ring-primary focus:ring-2"
        />
      </label>
    </div>
  )
}

function ExpenseRow({
  monthId, expense: exp, updateExpense, deleteExpense,
}: { monthId: string; expense: Expense; updateExpense: (id: string, e: Expense) => void; deleteExpense: (id: string, eid: string) => void }) {
  const [nameDraft, setNameDraft] = useState(exp.name)
  const [valueDraft, setValueDraft] = useState(formatMoneyForInput(exp.value))

  useEffect(() => { setNameDraft(exp.name); setValueDraft(formatMoneyForInput(exp.value)) }, [exp.id, exp.name, exp.value])

  const commitName  = () => { if (nameDraft !== exp.name) updateExpense(monthId, { ...exp, name: nameDraft }) }
  const commitValue = () => { const p = parseMoneyInput(valueDraft); if (p !== exp.value) updateExpense(monthId, { ...exp, value: p }); setValueDraft(formatMoneyForInput(p)) }

  const tagMeta = exp.tag ? EXPENSE_TAGS[exp.tag] : null
  const categoryIcon = tagMeta?.emoji ?? '📌'
  const categoryTitle = tagMeta?.label ?? 'Sem etiqueta'
  const installmentHint = exp.installment
    ? `Parcela ${exp.installment.current}/${exp.installment.total}`
    : ''

  return (
    <tr
      className={`border-b border-border/60 ${
        exp.consider
          ? 'bg-white/[0.07] light:bg-sky-50/95'
          : 'bg-red-950/40 light:bg-red-50'
      }`}
    >
      <td className="min-w-0 overflow-hidden px-1 py-0 align-middle sm:py-0.5">
        <div className="flex min-w-0 items-center gap-0.5">
          <span
            className="shrink-0 select-none text-[0.7rem] leading-none sm:text-[0.8rem]"
            title={[categoryTitle, installmentHint].filter(Boolean).join(' · ') || undefined}
            aria-hidden
          >
            {categoryIcon}
          </span>
          <div className="min-w-0 flex-1 overflow-hidden">
            <input
              type="text"
              data-sheet-input
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              placeholder="Descrição"
              title={nameDraft || undefined}
              className="sheet-ios-hack-name min-w-0 w-full rounded border border-transparent px-0.5 py-0 text-[0.6875rem] font-medium leading-tight focus:border-primary/40 focus:outline-none sm:px-1 sm:py-0.5 sm:text-[11px] md:text-xs"
            />
          </div>
          {exp.installment ? (
            <span
              className="shrink-0 text-[0.5rem] font-semibold tabular-nums leading-none text-muted sm:text-[0.5625rem]"
              title={installmentHint}
            >
              {exp.installment.current}/{exp.installment.total}×
            </span>
          ) : null}
        </div>
      </td>
      <td className="overflow-hidden px-0.5 py-0 align-middle sm:px-1 sm:py-0.5">
        <input
          type="text"
          inputMode="decimal"
          data-sheet-input
          value={valueDraft}
          onChange={e => setValueDraft(e.target.value)}
          onBlur={commitValue}
          onFocus={e => e.target.select()}
          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="sheet-ios-hack-value w-full rounded border border-transparent px-0.5 py-0.5 text-right text-[0.6875rem] font-bold tabular-nums focus:border-primary/40 focus:outline-none sm:px-1 sm:py-1.5 sm:text-xs md:text-sm"
        />
      </td>
      <td className="px-0.5 py-0 align-middle sm:py-0.5">
        <div className="flex gap-px sm:gap-0.5">
          <button type="button" onClick={() => updateExpense(monthId, { ...exp, consider: true })}
            className={`min-h-0 flex-1 rounded py-0.5 text-[0.5625rem] font-bold leading-none transition sm:py-2 sm:text-[0.625rem] sm:text-xs ${exp.consider ? 'bg-emerald-600 text-white light:bg-emerald-700' : 'bg-slate-800 text-slate-200 light:bg-slate-200 light:text-slate-800'}`}
          ><span className="sm:hidden">S</span><span className="hidden sm:inline">Sim</span></button>
          <button type="button" onClick={() => updateExpense(monthId, { ...exp, consider: false })}
            className={`min-h-0 flex-1 rounded py-0.5 text-[0.5625rem] font-bold leading-none transition sm:py-2 sm:text-[0.625rem] sm:text-xs ${!exp.consider ? 'bg-red-600 text-white light:bg-red-700' : 'bg-slate-800 text-slate-200 light:bg-slate-200 light:text-slate-800'}`}
          ><span className="sm:hidden">N</span><span className="hidden sm:inline">Não</span></button>
        </div>
      </td>
      <td className="px-0.5 py-0 align-middle sm:py-0.5">
        <button type="button" onClick={() => updateExpense(monthId, { ...exp, status: nextStatus(exp.status) })}
          className={`w-full min-h-0 rounded py-0.5 text-[0.5625rem] font-bold leading-tight transition sm:py-2 sm:text-[0.625rem] sm:text-xs ${exp.status === 'ok' ? 'bg-emerald-700 text-white light:bg-emerald-700' : 'bg-red-700 text-white light:bg-red-700'}`}
        >{statusShort(exp.status)}</button>
      </td>
      <td className="px-0 py-0 align-middle text-center sm:py-0.5">
        <button type="button" aria-label="Excluir" onClick={() => deleteExpense(monthId, exp.id)}
          className="sheet-row-icon rounded p-0.5 hover:bg-danger/15 sm:p-1"
        ><Trash2 className="mx-auto h-3 w-3 sm:h-3.5 md:h-4" /></button>
      </td>
    </tr>
  )
}

// ─── TemplatePicker ────────────────────────────────────────────────────────────

function TemplatePicker({ category, templates, onSelect, onBlank, onClose }: {
  category: ExpenseCategory
  templates: ExpenseTemplate[]
  onSelect: (t: ExpenseTemplate) => void
  onBlank: () => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = templates.filter(t => t.category === category && t.name.toLowerCase().includes(search.toLowerCase()))
  const meta = SECTION_META[category]

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="rounded-t-2xl bg-bg border-t border-border flex flex-col max-h-[75dvh]" onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1"><div className="h-1 w-10 rounded-full bg-border" /></div>
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 ${meta.headerClass} mx-4 rounded-xl`}>
          <span className="text-sm font-bold">{meta.title}</span>
          <button onClick={onClose}><X className="h-4 w-4 opacity-80" /></button>
        </div>
        {/* Search */}
        <div className="px-4 pt-3">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar item..."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-textMain outline-none ring-primary placeholder:text-muted/50 focus:ring-2"
          />
        </div>
        {/* Lista */}
        <div className="overflow-y-auto flex-1 px-4 py-2 space-y-1">
          {filtered.length === 0 && <p className="py-4 text-center text-sm text-muted">Nenhum item encontrado.</p>}
          {filtered.map(t => (
            <button key={t.id} type="button" onClick={() => onSelect(t)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-left transition active:scale-[0.98] hover:bg-card"
            >
              <span className="text-lg">{t.tag ? EXPENSE_TAGS[t.tag]?.emoji : '📌'}</span>
              <span className="flex-1 text-sm font-medium text-textMain">{t.name}</span>
              {t.tag && <span className="text-[0.625rem] text-muted">{EXPENSE_TAGS[t.tag]?.label}</span>}
            </button>
          ))}
        </div>
        {/* Item avulso */}
        <div className="px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2 border-t border-border">
          <button type="button" onClick={onBlank}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-medium text-muted transition hover:border-primary/50 hover:text-primary"
          >
            <Plus className="h-4 w-4" />
            Item avulso (sem template)
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ItemsTab ──────────────────────────────────────────────────────────────────

function ItemsTab({ templates, addTemplate, updateTemplate, deleteTemplate }: {
  templates: ExpenseTemplate[]
  addTemplate: (t: ExpenseTemplate) => void
  updateTemplate: (t: ExpenseTemplate) => void
  deleteTemplate: (id: string) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newCat, setNewCat] = useState<ExpenseCategory>('monthly')
  const [newTag, setNewTag] = useState<ExpenseTag | ''>('')
  const [adding, setAdding] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<ExpenseCategory, boolean>>({
    monthly: false, credit_card: false, others: false,
  })

  const handleAdd = () => {
    if (!newName.trim()) return
    addTemplate({ id: `tpl-${Date.now()}`, name: newName.trim(), category: newCat, tag: newTag || undefined })
    setNewName(''); setNewCat('monthly'); setNewTag(''); setAdding(false)
  }

  return (
    <div className="animate-fade-in space-y-4 px-1">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-textMain">Itens e Categorias</h2>
          <p className="text-xs text-muted mt-0.5">Altere uma vez — todos os meses refletem automaticamente.</p>
        </div>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary light:text-indigo-800 transition active:scale-95"
          ><Plus className="h-3.5 w-3.5" />Novo</button>
        )}
      </div>

      {adding && (
        <div className="rounded-xl border border-primary/30 bg-surface p-4 space-y-3">
          <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do item"
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textMain outline-none ring-primary placeholder:text-muted/50 focus:ring-2"
          />
          <div className="grid grid-cols-2 gap-2">
            <select value={newCat} onChange={e => setNewCat(e.target.value as ExpenseCategory)}
              className="rounded-lg border border-border bg-bg px-2 py-2 text-sm text-textMain outline-none"
            >
              <option value="monthly">Custo mensal</option>
              <option value="credit_card">Cartão de crédito</option>
              <option value="others">Outros</option>
            </select>
            <select value={newTag} onChange={e => setNewTag(e.target.value as ExpenseTag | '')}
              className="rounded-lg border border-border bg-bg px-2 py-2 text-sm text-textMain outline-none"
            >
              <option value="">🏷️ Tag (opcional)</option>
              {(Object.entries(EXPENSE_TAGS) as [ExpenseTag, { emoji: string; label: string }][]).map(([key, { emoji, label }]) => (
                <option key={key} value={key}>{emoji} {label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleAdd}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white transition active:scale-95"
            >Salvar</button>
            <button type="button" onClick={() => setAdding(false)}
              className="flex-1 rounded-lg border border-border py-2 text-sm font-semibold text-muted transition active:scale-95"
            >Cancelar</button>
          </div>
        </div>
      )}

      {CATEGORY_ORDER.map(cat => {
        const catTemplates = templates.filter(t => t.category === cat)
        const meta = SECTION_META[cat]
        const isCollapsed = collapsed[cat]
        return (
          <section key={cat} className="rounded-xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))}
              className={`flex w-full items-center gap-2 px-4 py-2.5 text-left ${meta.headerClass}`}
            >
              <span className="flex-1 text-[0.6875rem] font-bold tracking-widest">{meta.title}</span>
              <span className="text-[0.625rem] opacity-70 font-normal">({catTemplates.length})</span>
              {isCollapsed ? <ChevronRight className="h-4 w-4 shrink-0 opacity-80" /> : <ChevronDown className="h-4 w-4 shrink-0 opacity-80" />}
            </button>
            {!isCollapsed && (
              <>
                {catTemplates.length === 0 && (
                  <p className="px-4 py-3 text-xs text-muted">Nenhum item nesta categoria.</p>
                )}
                <div className="divide-y divide-border/40">
                  {catTemplates.map(t => (
                    <TemplateItem key={t.id} template={t} isEditing={editingId === t.id}
                      onEdit={() => setEditingId(t.id)}
                      onClose={() => setEditingId(null)}
                      onUpdate={updateTemplate}
                      onDelete={() => { deleteTemplate(t.id); setEditingId(null) }}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )
      })}
    </div>
  )
}

function TemplateItem({ template: t, isEditing, onEdit, onClose, onUpdate, onDelete }: {
  template: ExpenseTemplate
  isEditing: boolean
  onEdit: () => void
  onClose: () => void
  onUpdate: (t: ExpenseTemplate) => void
  onDelete: () => void
}) {
  const [nameDraft, setNameDraft] = useState(t.name)
  const [tagDraft, setTagDraft]   = useState<ExpenseTag | ''>(t.tag ?? '')

  useEffect(() => { setNameDraft(t.name); setTagDraft(t.tag ?? '') }, [t.id, t.name, t.tag])

  const handleSave = () => {
    onUpdate({ ...t, name: nameDraft.trim() || t.name, tag: tagDraft || undefined })
    onClose()
  }

  if (isEditing) {
    return (
      <div className="bg-card/50 px-4 py-3 space-y-2">
        <input type="text" value={nameDraft} onChange={e => setNameDraft(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-textMain outline-none ring-primary focus:ring-2"
        />
        <select value={tagDraft} onChange={e => setTagDraft(e.target.value as ExpenseTag | '')}
          className="w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm text-textMain outline-none"
        >
          <option value="">🏷️ Sem tag</option>
          {(Object.entries(EXPENSE_TAGS) as [ExpenseTag, { emoji: string; label: string }][]).map(([key, { emoji, label }]) => (
            <option key={key} value={key}>{emoji} {label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button type="button" onClick={handleSave} className="flex-1 rounded-lg bg-primary py-2 text-xs font-semibold text-white">Salvar</button>
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted">Cancelar</button>
          <button type="button" onClick={onDelete} className="rounded-lg border border-red-800/50 px-3 py-2 text-xs font-semibold text-red-400 light:border-red-300 light:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-base">{t.tag ? EXPENSE_TAGS[t.tag]?.emoji : '📌'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-textMain truncate">{t.name}</p>
        {t.tag && <p className="text-[0.625rem] text-muted">{EXPENSE_TAGS[t.tag]?.label}</p>}
      </div>
      <button type="button" onClick={onEdit} className="rounded-lg p-2 text-muted hover:bg-card hover:text-textMain transition">
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
