import type { Income, PersonIncome } from '../types'

/** Chaves estáveis por pessoa na renda (até 6). */
export const INCOME_SLOT_KEYS = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'] as const
export type IncomeSlotKey = (typeof INCOME_SLOT_KEYS)[number]

export const MAX_INCOME_SLOTS = INCOME_SLOT_KEYS.length

export function incomeKeysForCount(count: number): IncomeSlotKey[] {
  const n = Math.min(MAX_INCOME_SLOTS, Math.max(1, Math.floor(count)))
  return INCOME_SLOT_KEYS.slice(0, n) as IncomeSlotKey[]
}

export function emptyPersonIncome(): PersonIncome {
  return { salary: 0, others: 0 }
}

/** Converte renda antiga (josesmar/pamela) para p0/p1. */
export function migrateLegacyIncome(raw: Record<string, PersonIncome>): Income {
  const o = { ...raw } as Record<string, PersonIncome>
  if (o.josesmar && !o.p0) {
    o.p0 = o.josesmar
    delete o.josesmar
  }
  if (o.pamela && !o.p1) {
    o.p1 = o.pamela
    delete o.pamela
  }
  return o as Income
}

export function ensureIncomeSlots(income: Income | Record<string, PersonIncome>, count: number): Income {
  const m = migrateLegacyIncome({ ...income })
  const keys = incomeKeysForCount(count)
  const next: Income = { ...m }
  for (const k of keys) {
    if (!next[k]) next[k] = emptyPersonIncome()
  }
  return next
}

export function emptyIncomeTemplate(count: number): Income {
  const keys = incomeKeysForCount(count)
  const o: Record<string, PersonIncome> = {}
  for (const k of keys) o[k] = emptyPersonIncome()
  return o as Income
}

export function sumIncomeSlots(income: Income | Record<string, PersonIncome>, slotCount: number): number {
  const inc = migrateLegacyIncome({ ...income })
  const keys = incomeKeysForCount(slotCount)
  let s = 0
  for (const k of keys) {
    const p = inc[k]
    if (p) s += p.salary + p.others
  }
  return s
}
