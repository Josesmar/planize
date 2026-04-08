export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
      notation: 'compact',
    }).format(value)
  }
  return formatCurrency(value)
}

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const MONTHS_PT_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
]

export function getMonthName(month: number): string {
  return MONTHS_PT[month - 1] ?? ''
}

export function getMonthNameShort(month: number): string {
  return MONTHS_PT_SHORT[month - 1] ?? ''
}

export function formatMonthYear(month: number, year: number): string {
  return `${getMonthName(month)} ${year}`
}

export function formatPercent(value: number): string {
  return `${value}%`
}

/** Valor para edição no padrão brasileiro (ex.: 1.234,56). */
export function formatMoneyForInput(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

/** Interpreta texto digitado como valor monetário (vírgula ou ponto decimal). */
export function parseMoneyInput(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed) return 0
  const normalized = trimmed.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}
