import type { Expense, ExpenseCategory, ExpenseTag, MonthData } from '../types'
import { sumIncomeSlots } from './incomeModel'

export function getTotalIncome(month: MonthData, incomeSlotCount: number): number {
  return sumIncomeSlots(month.income, incomeSlotCount)
}

/** Soma valores só das linhas com "Sim" em considerar; "Não" fica de fora. */
export function getTotalExpenses(month: MonthData): number {
  return month.expenses
    .filter(e => e.consider)
    .reduce((sum, e) => sum + e.value, 0)
}

export function getWithdrawalAmount(month: MonthData, incomeSlotCount: number): number {
  const totalIncome = getTotalIncome(month, incomeSlotCount)
  return totalIncome * (month.withdrawalPJ + month.withdrawalReserve) / 100
}

/** Renda − despesas só com "Sim" em considerar (visão de orçamento). */
export function getNetBalance(month: MonthData, incomeSlotCount: number): number {
  return getTotalIncome(month, incomeSlotCount) - getTotalExpenses(month)
}

/** Renda − soma de **todas** as linhas da planilha (Sim e Não). Usado no Líq. previsto do resumo. */
export function getLiquidoPrevisto(month: MonthData, incomeSlotCount: number): number {
  return getTotalIncome(month, incomeSlotCount) - getTotalExpenseLines(month)
}

/** Linha já quitada: só `status === 'ok'` (pending e null contam como a pagar). */
export function isExpensePaid(e: Expense): boolean {
  return e.consider && e.status === 'ok'
}

export function getAmountPaid(month: MonthData): number {
  return month.expenses
    .filter(isExpensePaid)
    .reduce((sum, e) => sum + e.value, 0)
}

export function getAmountPending(month: MonthData): number {
  return getTotalExpenses(month) - getAmountPaid(month)
}

/**
 * Progresso de pagamento só nas linhas **Sim** em considerar (igual Débitos / líquidos).
 * Incluir linhas "Não" inflava o total e parecia haver pendências quando só faltava
 * marcar despesa fora do orçamento.
 */
export function getPaymentProgress(month: MonthData): { paid: number; total: number; percentage: number } {
  const trackable = month.expenses.filter(e => e.consider && e.value > 0)
  const total = trackable.length
  const paid = trackable.filter(e => isExpensePaid(e)).length
  const percentage = total > 0 ? (paid / total) * 100 : 0
  return { paid, total, percentage }
}

export function getCategoryTotal(expenses: Expense[], category: string): number {
  return expenses
    .filter(e => e.consider && e.category === category)
    .reduce((sum, e) => sum + e.value, 0)
}

export function getCategoryExpenses(expenses: Expense[], category: string): Expense[] {
  return expenses.filter(e => e.category === category)
}

/** Soma da categoria incluindo linhas "Não" em considerar (total da secção na planilha). */
export function getCategoryTotalAllLines(expenses: Expense[], category: string): number {
  return getCategoryExpenses(expenses, category).reduce((sum, e) => sum + (Number(e.value) || 0), 0)
}

export function getSavingsRate(month: MonthData, incomeSlotCount: number): number {
  const totalIncome = getTotalIncome(month, incomeSlotCount)
  const totalExpenses = getTotalExpenses(month)
  if (totalIncome === 0) return 0
  return Math.max(0, ((totalIncome - totalExpenses) / totalIncome) * 100)
}

/** Renda menos o que já está pago (itens considerados com situação Ok), como na planilha. */
export function getLiquidoAtual(month: MonthData, incomeSlotCount: number): number {
  return getTotalIncome(month, incomeSlotCount) - getAmountPaid(month)
}

/** Soma de todas as linhas de despesa (ignora "considerar"). */
export function getTotalExpenseLines(month: MonthData): number {
  return month.expenses.reduce((sum, e) => sum + e.value, 0)
}

export interface MonthSpendingSnapshot {
  month: MonthData
  considered: number
  allLines: number
}

export function getMonthsInYear(months: MonthData[], year: number): MonthData[] {
  return months.filter(m => m.year === year).sort((a, b) => a.month - b.month)
}

export function getMonthSpendingSnapshot(m: MonthData): MonthSpendingSnapshot {
  return {
    month: m,
    considered: getTotalExpenses(m),
    allLines: getTotalExpenseLines(m),
  }
}

const CATEGORIES: ExpenseCategory[] = ['monthly', 'credit_card', 'others']

/** Totais por categoria no mês (todas as linhas da secção, Sim e Não — alinhado aos rodapés da planilha). */
export function getSpendingByCategory(month: MonthData): Record<ExpenseCategory, number> {
  return {
    monthly: getCategoryTotalAllLines(month.expenses, 'monthly'),
    credit_card: getCategoryTotalAllLines(month.expenses, 'credit_card'),
    others: getCategoryTotalAllLines(month.expenses, 'others'),
  }
}

/** Agrega por categoria em vários meses (todas as linhas por secção). */
export function getAnnualSpendingByCategory(monthsInYear: MonthData[]): Record<ExpenseCategory, number> {
  const acc: Record<ExpenseCategory, number> = { monthly: 0, credit_card: 0, others: 0 }
  for (const m of monthsInYear) {
    for (const cat of CATEGORIES) {
      acc[cat] += getCategoryTotalAllLines(m.expenses, cat)
    }
  }
  return acc
}

export interface AnnualSpendingMetrics {
  year: number
  monthCount: number
  /** Soma dos gastos com "Sim" em considerar. */
  totalConsidered: number
  /** Soma de todos os valores lançados no ano. */
  totalAllLines: number
  /** Média mensal (gastos considerados). */
  avgMonthlyConsidered: number
  /** Média mensal (todas as linhas). */
  avgMonthlyAllLines: number
  /** Soma por secção da planilha (todas as linhas, Sim e Não). */
  byCategory: Record<ExpenseCategory, number>
  snapshots: MonthSpendingSnapshot[]
}

export function getAnnualSpendingMetrics(months: MonthData[], year: number): AnnualSpendingMetrics {
  const list = getMonthsInYear(months, year)
  const snapshots = list.map(getMonthSpendingSnapshot)
  const monthCount = snapshots.length
  const totalConsidered = snapshots.reduce((s, x) => s + x.considered, 0)
  const totalAllLines = snapshots.reduce((s, x) => s + x.allLines, 0)
  const avgMonthlyConsidered = monthCount > 0 ? totalConsidered / monthCount : 0
  const avgMonthlyAllLines = monthCount > 0 ? totalAllLines / monthCount : 0
  const byCategory = getAnnualSpendingByCategory(list)

  return {
    year,
    monthCount,
    totalConsidered,
    totalAllLines,
    avgMonthlyConsidered,
    avgMonthlyAllLines,
    byCategory,
    snapshots,
  }
}

/** Renda total agregada no ano (soma dos meses cadastrados). */
export function getAnnualIncomeTotal(monthsInYear: MonthData[], incomeSlotCount: number): number {
  return monthsInYear.reduce((s, m) => s + getTotalIncome(m, incomeSlotCount), 0)
}

/** Gastos considerados agrupados por tag em um mês. */
export function getSpendingByTag(month: MonthData): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const e of month.expenses) {
    if (!e.consider) continue
    const key = e.tag ?? 'outros'
    acc[key] = (acc[key] ?? 0) + e.value
  }
  return acc
}

/** Gastos considerados agrupados por tag em vários meses. */
export function getAnnualSpendingByTag(months: MonthData[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const m of months) {
    const byTag = getSpendingByTag(m)
    for (const [tag, val] of Object.entries(byTag)) {
      acc[tag] = (acc[tag] ?? 0) + val
    }
  }
  return acc
}
