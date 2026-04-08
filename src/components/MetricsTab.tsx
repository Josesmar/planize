import { useMemo, useState } from 'react'
import { TrendingDown, TrendingUp, Wallet, CreditCard } from 'lucide-react'
import type { MonthData } from '../types'
import { EXPENSE_TAGS } from '../App'
import {
  getAnnualIncomeTotal,
  getAnnualSpendingByTag,
  getAnnualSpendingMetrics,
  getAmountPaid,
  getCategoryTotalAllLines,
  getLiquidoAtual,
  getLiquidoPrevisto,
  getPaymentProgress,
  getSavingsRate,
  getSpendingByCategory,
  getSpendingByTag,
  getTotalExpenses,
  getTotalIncome,
} from '../utils/calculations'
import {
  formatCurrency,
  formatCurrencyCompact,
  formatMonthYear,
  getMonthNameShort,
} from '../utils/format'
import {
  CategoryDoughnutChart,
  IncomeVsSpendingLineChart,
  MonthlySpendingBarChart,
} from './MetricsCharts'

type MetricsView = 'month' | 'year' | 'compare' | 'evolution'

const CAT_COLORS: Record<string, string> = {
  monthly:     '#6366F1',
  credit_card: '#14B8A6',
  others:      '#EAB308',
}
const CAT_LABEL: Record<string, string> = {
  monthly:     'Custo Mensal',
  credit_card: 'Cartão de Crédito',
  others:      'Outros',
}

export function MetricsTab({
  months,
  currentMonth,
  incomeSlotCount,
  onNavigateMonth,
}: {
  months: MonthData[]
  currentMonth: MonthData
  incomeSlotCount: number
  onNavigateMonth: (id: string) => void
}) {
  const [view, setView] = useState<MetricsView>('month')
  const sortedMonths = useMemo(
    () => [...months].sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month),
    [months]
  )
  const availableYears = useMemo(
    () => [...new Set(months.map(m => m.year))].sort((a, b) => b - a),
    [months]
  )
  const [selectedYear, setSelectedYear] = useState(() => availableYears[0] ?? new Date().getFullYear())
  const [compareA, setCompareA] = useState(sortedMonths[sortedMonths.length - 1]?.id ?? '')
  const [compareB, setCompareB] = useState(sortedMonths[sortedMonths.length - 2]?.id ?? sortedMonths[0]?.id ?? '')

  return (
    <div className="animate-fade-in space-y-4">
      {/* ── View switcher ── */}
      <div className="flex rounded-xl border border-border bg-surface p-1 gap-1">
        {([['month', 'Mês'], ['year', 'Ano'], ['compare', 'Comparar'], ['evolution', 'Evolução']] as [MetricsView, string][]).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setView(v)}
            className={`flex-1 rounded-lg py-2 text-[0.6875rem] font-semibold transition ${view === v ? 'bg-primary text-white shadow' : 'text-muted hover:text-textMain'}`}
          >{label}</button>
        ))}
      </div>

      {view === 'month' && <MonthView month={currentMonth} incomeSlotCount={incomeSlotCount} />}
      {view === 'year' && (
        <YearView
          months={months}
          sortedMonths={sortedMonths}
          availableYears={availableYears}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          incomeSlotCount={incomeSlotCount}
          onBarClick={onNavigateMonth}
        />
      )}
      {view === 'compare' && (
        <CompareView
          sortedMonths={sortedMonths}
          compareA={compareA}
          compareB={compareB}
          setCompareA={setCompareA}
          setCompareB={setCompareB}
          incomeSlotCount={incomeSlotCount}
        />
      )}
      {view === 'evolution' && (
        <EvolutionView
          sortedMonths={sortedMonths}
          incomeSlotCount={incomeSlotCount}
          onNavigateMonth={onNavigateMonth}
        />
      )}
    </div>
  )
}

// ─── Mês ──────────────────────────────────────────────────────────────────────

function MonthView({ month, incomeSlotCount }: { month: MonthData; incomeSlotCount: number }) {
  const income       = getTotalIncome(month, incomeSlotCount)
  const expenses     = getTotalExpenses(month)
  const liquid       = getLiquidoPrevisto(month, incomeSlotCount)
  const liquidAtual  = getLiquidoAtual(month, incomeSlotCount)
  const paid         = getAmountPaid(month)
  const progress     = getPaymentProgress(month)
  const savingsRate  = getSavingsRate(month, incomeSlotCount)
  const byCat        = getSpendingByCategory(month)
  const byTag        = getSpendingByTag(month)
  const ccTotal      = byCat.credit_card

  const tagEntries = Object.entries(byTag)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
  const tagTotal = tagEntries.reduce((s, [, v]) => s + v, 0)
  const catTotal = byCat.monthly + byCat.credit_card + byCat.others

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <KpiCard icon={<Wallet className="h-4 w-4" />} label="Renda" value={formatCurrency(income)} color="text-emerald-400 light:text-emerald-800" bg="bg-emerald-500/15 light:bg-emerald-600/12" />
        <KpiCard icon={<TrendingDown className="h-4 w-4" />} label="Débitos" value={formatCurrency(expenses)} color="text-red-400 light:text-red-800" bg="bg-red-500/15 light:bg-red-600/10" />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Líquido previsto" value={formatCurrency(liquid)} color={liquid >= 0 ? 'text-emerald-400 light:text-emerald-800' : 'text-red-400 light:text-red-800'} bg={liquid >= 0 ? 'bg-emerald-500/15 light:bg-emerald-600/12' : 'bg-red-500/15 light:bg-red-600/10'} />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Líquido atual" value={formatCurrency(liquidAtual)} color={liquidAtual >= 0 ? 'text-emerald-400 light:text-emerald-800' : 'text-red-400 light:text-red-800'} bg={liquidAtual >= 0 ? 'bg-emerald-500/15 light:bg-emerald-600/12' : 'bg-red-500/15 light:bg-red-600/10'} />
      </div>

      {/* Taxa de poupança */}
      <div className="rounded-xl border border-border bg-surface px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted">Taxa de poupança</span>
          <span className={`text-sm font-bold tabular-nums ${savingsRate >= 20 ? 'text-emerald-400 light:text-emerald-800' : savingsRate >= 10 ? 'text-amber-400 light:text-amber-800' : 'text-red-400 light:text-red-800'}`}>
            {savingsRate.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/12 light:bg-slate-200">
          <div className={`h-full rounded-full transition-all ${savingsRate >= 20 ? 'bg-emerald-500 light:bg-emerald-600' : savingsRate >= 10 ? 'bg-amber-400 light:bg-amber-500' : 'bg-red-500 light:bg-red-600'}`}
            style={{ width: `${Math.min(100, savingsRate)}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-[0.625rem] text-slate-400 light:text-slate-600">
          <span>Pago {formatCurrency(paid)}</span>
          <span>{progress.paid}/{progress.total} itens</span>
        </div>
      </div>

      {/* Cartão de crédito destaque */}
      <div className="rounded-xl border border-[#14B8A6]/30 bg-[#14B8A6]/5 light:border-teal-600/35 light:bg-teal-50/80 px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="h-4 w-4 text-[#14B8A6] light:text-teal-700" />
          <span className="text-xs font-semibold text-[#14B8A6] light:text-teal-800">Cartão de Crédito</span>
        </div>
        <p className="text-2xl font-bold tabular-nums text-textMain">{formatCurrency(ccTotal)}</p>
        {income > 0 && (
          <p className="mt-1 text-xs text-muted">{(ccTotal / income * 100).toFixed(1)}% da renda</p>
        )}
      </div>

      {/* Por categoria */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Por categoria</p>
        <div className="space-y-3">
          {(['monthly', 'credit_card', 'others'] as const).map(cat => {
            const val = byCat[cat]
            const pct = catTotal > 0 ? (val / catTotal) * 100 : 0
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-textMain">{CAT_LABEL[cat]}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">{pct.toFixed(0)}%</span>
                    <span className="text-xs font-semibold tabular-nums text-textMain">{formatCurrency(val)}</span>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/12 light:bg-slate-200">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: CAT_COLORS[cat] }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Por tag */}
      {tagEntries.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Por tag</p>
          <div className="space-y-3">
            {tagEntries.map(([tag, val]) => {
              const meta = EXPENSE_TAGS[tag as keyof typeof EXPENSE_TAGS]
              const pct = tagTotal > 0 ? (val / tagTotal) * 100 : 0
              return (
                <div key={tag}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-textMain">
                      {meta ? `${meta.emoji} ${meta.label}` : tag}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">{pct.toFixed(0)}%</span>
                      <span className="text-xs font-semibold tabular-nums text-textMain">{formatCurrency(val)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/12 light:bg-slate-200">
                    <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Ano ──────────────────────────────────────────────────────────────────────

function YearView({
  months, sortedMonths, availableYears, selectedYear, setSelectedYear, incomeSlotCount, onBarClick,
}: {
  months: MonthData[]
  sortedMonths: MonthData[]
  availableYears: number[]
  selectedYear: number
  setSelectedYear: (y: number) => void
  incomeSlotCount: number
  onBarClick: (id: string) => void
}) {
  const annual = useMemo(() => getAnnualSpendingMetrics(months, selectedYear), [months, selectedYear])
  const annualIncome = useMemo(
    () => getAnnualIncomeTotal(annual.snapshots.map(s => s.month), incomeSlotCount),
    [annual.snapshots, incomeSlotCount]
  )
  const byTag = useMemo(() => getAnnualSpendingByTag(annual.snapshots.map(s => s.month)), [annual.snapshots])

  const monthLabels = annual.snapshots.map(s => `${getMonthNameShort(s.month.month)}/${String(s.month.year).slice(-2)}`)
  const monthValues = annual.snapshots.map(s => s.considered)
  const incomeValues = annual.snapshots.map(s => getTotalIncome(s.month, incomeSlotCount))

  const catLabels = ['Custo Mensal', 'Cartão de Crédito', 'Outros']
  const catValues = [annual.byCategory.monthly, annual.byCategory.credit_card, annual.byCategory.others]
  const catTotal  = catValues.reduce((a, b) => a + b, 0)

  const tagEntries = Object.entries(byTag).filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a)
  const tagTotal   = tagEntries.reduce((s, [, v]) => s + v, 0)

  if (annual.monthCount === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
        Nenhum mês cadastrado para {selectedYear}.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Year selector */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">{annual.monthCount} {annual.monthCount === 1 ? 'mês' : 'meses'} cadastrados</p>
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-textMain outline-none"
        >
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* KPIs anuais */}
      <div className="grid grid-cols-2 gap-2">
        <KpiCard icon={<Wallet className="h-4 w-4" />} label="Renda no ano" value={formatCurrency(annualIncome)} color="text-emerald-400 light:text-emerald-800" bg="bg-emerald-500/15 light:bg-emerald-600/12" />
        <KpiCard icon={<TrendingDown className="h-4 w-4" />} label="Gastos no ano" value={formatCurrency(annual.totalConsidered)} color="text-red-400 light:text-red-800" bg="bg-red-500/15 light:bg-red-600/10" />
        <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Média mensal" value={formatCurrency(annual.avgMonthlyConsidered)} color="text-primary light:text-indigo-800" bg="bg-primary/10" />
        <KpiCard icon={<CreditCard className="h-4 w-4" />} label="Cartão no ano" value={formatCurrency(annual.byCategory.credit_card)} color="text-[#14B8A6] light:text-teal-800" bg="bg-[#14B8A6]/10" />
      </div>

      {/* Bar chart mensal */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted mb-1">Gastos por mês</p>
        <p className="text-[0.625rem] text-muted mb-3">Toque numa coluna para abrir o mês.</p>
        <MonthlySpendingBarChart labels={monthLabels} values={monthValues}
          onBarClick={i => { const snap = annual.snapshots[i]; if (snap) onBarClick(snap.month.id) }}
        />
      </div>

      {/* Renda vs gastos */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Renda vs Gastos</p>
        <IncomeVsSpendingLineChart labels={monthLabels} incomeValues={incomeValues} spendingValues={monthValues} />
      </div>

      {/* Por categoria barras */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Por categoria</p>
        <div className="space-y-3">
          {catLabels.map((label, i) => {
            const val = catValues[i]
            const pct = catTotal > 0 ? (val / catTotal) * 100 : 0
            const colors = [CAT_COLORS.monthly, CAT_COLORS.credit_card, CAT_COLORS.others]
            return (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-textMain">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">{pct.toFixed(0)}%</span>
                    <span className="text-xs font-semibold tabular-nums text-textMain">{formatCurrency(val)}</span>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/12 light:bg-slate-200">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: colors[i] }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Donut */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3 text-center">Distribuição por categoria</p>
        <CategoryDoughnutChart labels={catLabels} values={catValues} />
      </div>

      {/* Por tag */}
      {tagEntries.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Por tag (ano)</p>
          <div className="space-y-3">
            {tagEntries.map(([tag, val]) => {
              const meta = EXPENSE_TAGS[tag as keyof typeof EXPENSE_TAGS]
              const pct = tagTotal > 0 ? (val / tagTotal) * 100 : 0
              return (
                <div key={tag}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-textMain">
                      {meta ? `${meta.emoji} ${meta.label}` : tag}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">{pct.toFixed(0)}%</span>
                      <span className="text-xs font-semibold tabular-nums text-textMain">{formatCurrency(val)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/12 light:bg-slate-200">
                    <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Comparativo ──────────────────────────────────────────────────────────────

function CompareView({ sortedMonths, compareA, compareB, setCompareA, setCompareB, incomeSlotCount }: {
  sortedMonths: MonthData[]
  compareA: string
  compareB: string
  setCompareA: (id: string) => void
  setCompareB: (id: string) => void
  incomeSlotCount: number
}) {
  const mA = sortedMonths.find(m => m.id === compareA)
  const mB = sortedMonths.find(m => m.id === compareB)

  const metrics = (m: MonthData | undefined) => m ? {
    income:   getTotalIncome(m, incomeSlotCount),
    expenses: getTotalExpenses(m),
    liquid:   getLiquidoPrevisto(m, incomeSlotCount),
    cc:       getCategoryTotalAllLines(m.expenses, 'credit_card'),
    monthly:  getCategoryTotalAllLines(m.expenses, 'monthly'),
    others:   getCategoryTotalAllLines(m.expenses, 'others'),
    savings:  getSavingsRate(m, incomeSlotCount),
  } : null

  const a = metrics(mA)
  const b = metrics(mB)

  const rows: { label: string; keyA: keyof NonNullable<typeof a>; fmt?: 'currency' | 'pct' }[] = [
    { label: 'Renda',          keyA: 'income',   fmt: 'currency' },
    { label: 'Débitos',        keyA: 'expenses', fmt: 'currency' },
    { label: 'Líquido',        keyA: 'liquid',   fmt: 'currency' },
    { label: 'Cartão',         keyA: 'cc',       fmt: 'currency' },
    { label: 'Custo fixo',     keyA: 'monthly',  fmt: 'currency' },
    { label: 'Outros',         keyA: 'others',   fmt: 'currency' },
    { label: 'Taxa de poupança', keyA: 'savings', fmt: 'pct' },
  ]

  const fmt = (v: number, type?: 'currency' | 'pct') =>
    type === 'pct' ? `${v.toFixed(1)}%` : formatCurrency(v)

  const diff = (va: number, vb: number) => {
    const d = va - vb
    return { value: d, pct: vb !== 0 ? ((d / vb) * 100) : 0 }
  }

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[0.625rem] font-semibold text-primary mb-1 uppercase tracking-wide">Mês A</p>
          <select value={compareA} onChange={e => setCompareA(e.target.value)}
            className="w-full rounded-lg border border-primary/40 bg-surface px-2 py-2 text-sm text-textMain outline-none"
          >
            {sortedMonths.map(m => <option key={m.id} value={m.id}>{formatMonthYear(m.month, m.year)}</option>)}
          </select>
        </div>
        <div>
          <p className="text-[0.625rem] font-semibold text-[#14B8A6] mb-1 uppercase tracking-wide">Mês B</p>
          <select value={compareB} onChange={e => setCompareB(e.target.value)}
            className="w-full rounded-lg border border-[#14B8A6]/40 bg-surface px-2 py-2 text-sm text-textMain outline-none"
          >
            {sortedMonths.map(m => <option key={m.id} value={m.id}>{formatMonthYear(m.month, m.year)}</option>)}
          </select>
        </div>
      </div>

      {/* Header nomes */}
      {mA && mB && (
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 items-center">
          <span />
          <span className="text-[0.625rem] font-bold text-primary text-right uppercase">{getMonthNameShort(mA.month)}/{String(mA.year).slice(-2)}</span>
          <span className="text-[0.625rem] font-bold text-[#14B8A6] text-right uppercase">{getMonthNameShort(mB.month)}/{String(mB.year).slice(-2)}</span>
          <span className="text-[0.625rem] font-bold text-muted text-right uppercase">Δ</span>
        </div>
      )}

      {/* Tabela comparativa */}
      {a && b && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          {rows.map((row, i) => {
            const va = a[row.keyA] as number
            const vb = b[row.keyA] as number
            const { value: d, pct: dp } = diff(va, vb)
            const isLiquid = row.keyA === 'liquid' || row.keyA === 'savings'
            const better = isLiquid ? d > 0 : d < 0
            const worse  = isLiquid ? d < 0 : d > 0
            return (
              <div key={row.label} className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center px-4 py-3 ${i % 2 === 0 ? 'bg-card/30' : ''}`}>
                <span className="text-xs font-medium text-muted">{row.label}</span>
                <span className="text-xs font-bold tabular-nums text-primary text-right">{fmt(va, row.fmt)}</span>
                <span className="text-xs font-bold tabular-nums text-[#14B8A6] text-right">{fmt(vb, row.fmt)}</span>
                <span className={`text-[0.625rem] font-bold tabular-nums text-right ${better ? 'text-emerald-400 light:text-emerald-800' : worse ? 'text-red-400 light:text-red-800' : 'text-muted'}`}>
                  {d === 0 ? '=' : `${d > 0 ? '+' : ''}${dp.toFixed(0)}%`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Visual por categoria lado a lado */}
      {a && b && mA && mB && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Por categoria</p>
          <div className="space-y-4">
            {(['monthly', 'credit_card', 'others'] as const).map(cat => {
              const va = a[cat === 'monthly' ? 'monthly' : cat === 'credit_card' ? 'cc' : 'others'] as number
              const vb = b[cat === 'monthly' ? 'monthly' : cat === 'credit_card' ? 'cc' : 'others'] as number
              const max = Math.max(va, vb, 1)
              return (
                <div key={cat}>
                  <p className="text-[0.625rem] font-semibold text-muted mb-1.5 uppercase">{CAT_LABEL[cat]}</p>
                  <div className="space-y-1.5">
                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[0.625rem] text-primary">{getMonthNameShort(mA.month)}</span>
                        <span className="text-[0.625rem] font-semibold text-primary tabular-nums">{formatCurrencyCompact(va)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/12 light:bg-slate-200">
                        <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${(va / max) * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[0.625rem] text-[#14B8A6]">{getMonthNameShort(mB.month)}</span>
                        <span className="text-[0.625rem] font-semibold text-[#14B8A6] tabular-nums">{formatCurrencyCompact(vb)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/12 light:bg-slate-200">
                        <div className="h-full rounded-full bg-[#14B8A6]/70 transition-all" style={{ width: `${(vb / max) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(!mA || !mB) && (
        <p className="text-center text-sm text-muted py-6">Selecione dois meses para comparar.</p>
      )}
    </div>
  )
}

// ─── Evolução ─────────────────────────────────────────────────────────────────

const MONTH_SHORT = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MONTH_FULL  = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function EvolutionView({ sortedMonths, incomeSlotCount, onNavigateMonth }: {
  sortedMonths: MonthData[]
  incomeSlotCount: number
  onNavigateMonth: (id: string) => void
}) {
  const [selectedMonth, setSelectedMonth] = useState(0) // 0 = todos, 1–12 = mês específico

  const filteredMonths = useMemo(
    () => selectedMonth === 0 ? sortedMonths : sortedMonths.filter(m => m.month === selectedMonth),
    [sortedMonths, selectedMonth]
  )

  const chartLabels = useMemo(
    () => filteredMonths.map(m =>
      selectedMonth === 0
        ? `${getMonthNameShort(m.month)}/${String(m.year).slice(-2)}`
        : String(m.year)
    ),
    [filteredMonths, selectedMonth]
  )
  const chartSpending = useMemo(() => filteredMonths.map(m => getTotalExpenses(m)), [filteredMonths])
  const chartIncome   = useMemo(
    () => filteredMonths.map(m => getTotalIncome(m, incomeSlotCount)),
    [filteredMonths, incomeSlotCount]
  )

  // Which months exist in data (for pill highlight)
  const availableMonths = useMemo(
    () => new Set(sortedMonths.map(m => m.month)),
    [sortedMonths]
  )

  return (
    <div className="space-y-4">
      {/* Month filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {['Todos', ...MONTH_SHORT.slice(1)].map((name, i) => (
          <button key={i} type="button" onClick={() => setSelectedMonth(i)}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              selectedMonth === i
                ? 'bg-primary text-white'
                : availableMonths.has(i) || i === 0
                  ? 'bg-surface border border-border text-muted hover:text-textMain'
                  : 'bg-surface border border-border text-muted/30 cursor-default'
            }`}
          >{name}</button>
        ))}
      </div>

      {filteredMonths.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Sem dados para {MONTH_FULL[selectedMonth]}.
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-1">
              {selectedMonth === 0 ? 'Gastos — todos os meses' : `${MONTH_FULL[selectedMonth]} por ano`}
            </p>
            <p className="text-[0.625rem] text-muted mb-3">
              {filteredMonths.length} {filteredMonths.length === 1 ? 'mês' : 'meses'} · Toque para abrir.
            </p>
            <MonthlySpendingBarChart
              labels={chartLabels}
              values={chartSpending}
              onBarClick={i => { const m = filteredMonths[i]; if (m) onNavigateMonth(m.id) }}
            />
          </div>

          {/* Renda vs Gastos line */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-3">Renda vs Gastos</p>
            <IncomeVsSpendingLineChart
              labels={chartLabels}
              incomeValues={chartIncome}
              spendingValues={chartSpending}
            />
          </div>

          {/* Year-over-year table (only when a specific month is selected) */}
          {selectedMonth > 0 && (
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="grid grid-cols-[3rem_1fr_1fr_3rem] gap-x-3 items-center px-4 py-2 bg-card/50">
                <span className="text-[0.625rem] font-bold uppercase text-muted">Ano</span>
                <span className="text-[0.625rem] font-bold uppercase text-muted text-right">Renda</span>
                <span className="text-[0.625rem] font-bold uppercase text-muted text-right">Gastos</span>
                <span className="text-[0.625rem] font-bold uppercase text-muted text-right">Δ</span>
              </div>
              {filteredMonths.map((m, i) => {
                const spending = getTotalExpenses(m)
                const income   = getTotalIncome(m, incomeSlotCount)
                const prev     = filteredMonths[i - 1]
                const prevSpend = prev ? getTotalExpenses(prev) : null
                const delta = prevSpend != null && prevSpend > 0
                  ? ((spending - prevSpend) / prevSpend) * 100
                  : null
                const isBetter = delta !== null && delta < 0
                const isWorse  = delta !== null && delta > 0
                return (
                  <button key={m.id} type="button" onClick={() => onNavigateMonth(m.id)}
                    className={`w-full grid grid-cols-[3rem_1fr_1fr_3rem] gap-x-3 items-center px-4 py-3 text-left transition hover:bg-card/60 ${i % 2 === 0 ? 'bg-card/20' : ''}`}
                  >
                    <span className="text-xs font-bold text-textMain">{m.year}</span>
                    <span className="text-xs tabular-nums text-emerald-400 light:text-emerald-800 text-right">{formatCurrencyCompact(income)}</span>
                    <span className="text-xs tabular-nums text-red-400 light:text-red-800 text-right">{formatCurrencyCompact(spending)}</span>
                    <span className={`text-[0.625rem] font-bold tabular-nums text-right ${
                      isBetter ? 'text-emerald-400 light:text-emerald-800' : isWorse ? 'text-red-400 light:text-red-800' : 'text-muted'
                    }`}>
                      {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(0)}%`}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* Summary stats when specific month selected */}
          {selectedMonth > 0 && filteredMonths.length >= 2 && (() => {
            const values = filteredMonths.map(m => getTotalExpenses(m))
            const min = Math.min(...values)
            const max = Math.max(...values)
            const avg = values.reduce((a, b) => a + b, 0) / values.length
            const minMonth = filteredMonths[values.indexOf(min)]
            const maxMonth = filteredMonths[values.indexOf(max)]
            return (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border bg-surface p-3 text-center">
                  <p className="text-[0.625rem] text-muted mb-1">Menor gasto</p>
                  <p className="text-xs font-bold text-emerald-400 light:text-emerald-800 tabular-nums">{formatCurrencyCompact(min)}</p>
                  <p className="text-[0.625rem] text-muted mt-0.5">{minMonth.year}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3 text-center">
                  <p className="text-[0.625rem] text-muted mb-1">Média</p>
                  <p className="text-xs font-bold text-primary tabular-nums">{formatCurrencyCompact(avg)}</p>
                  <p className="text-[0.625rem] text-muted mt-0.5">{filteredMonths.length} anos</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3 text-center">
                  <p className="text-[0.625rem] text-muted mb-1">Maior gasto</p>
                  <p className="text-xs font-bold text-red-400 light:text-red-800 tabular-nums">{formatCurrencyCompact(max)}</p>
                  <p className="text-[0.625rem] text-muted mt-0.5">{maxMonth.year}</p>
                </div>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, color, bg }: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
  bg: string
}) {
  return (
    <div className={`rounded-xl border border-border p-3 ${bg}`}>
      <div className={`flex items-center gap-1.5 mb-1 ${color}`}>
        {icon}
        <span className="text-[0.625rem] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-base font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}
