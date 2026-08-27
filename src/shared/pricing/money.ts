import type { BudgetMode, Money } from '@/shared/api'

/**
 * The contract speaks integer minor units plus a currency (RULE-CORE-004).
 * VND has no minor unit, so `amount` is dong; this module is the only place
 * that knows that, so adding a 2-decimal currency later changes one file.
 */
const ZERO_DECIMAL_CURRENCIES = new Set(['VND', 'JPY', 'KRW'])

export const DEFAULT_CURRENCY = 'VND'

export function minorUnitDigits(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2
}

/** Minor units → the major-unit number used for display only. */
export function toMajorUnits(amount: number, currency: string): number {
  const digits = minorUnitDigits(currency)
  return digits === 0 ? amount : amount / 10 ** digits
}

/**
 * Per-person figures round UP to the nearest 5,000 dong: an estimate must never
 * look more precise than it is (spec v3 §23).
 */
const VND_ROUNDING = 5_000

export function perPerson(totalMinor: number, participantCount: number, currency = DEFAULT_CURRENCY): number {
  if (participantCount <= 0) return totalMinor
  const exact = totalMinor / participantCount
  if (currency.toUpperCase() !== 'VND') return Math.ceil(exact)
  return Math.ceil(exact / VND_ROUNDING) * VND_ROUNDING
}

/**
 * "450k", "1.2tr" — the compact Vietnamese money style the screens use.
 * Never called with a raw major-unit number; always minor units + currency.
 */
export function formatMoney(amount: number, currency = DEFAULT_CURRENCY): string {
  const major = toMajorUnits(amount, currency)
  if (currency.toUpperCase() !== 'VND') {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(major)
  }
  if (major >= 1_000_000) {
    const millions = major / 1_000_000
    const rendered = Number.isInteger(millions) ? String(millions) : millions.toFixed(1)
    return `${rendered.replace('.', ',')}tr`
  }
  if (major >= 1_000) return `${Math.round(major / 1_000)}k`
  return String(major)
}

export function formatMoneyObject(money: Money | undefined): string | null {
  if (!money) return null
  return formatMoney(money.amount, money.currency)
}

/**
 * A price range with an unknown upper bound must read as uncertain, never as a
 * confident number (RULE-CORE-008).
 */
export function formatRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency = DEFAULT_CURRENCY,
): string | null {
  if (min == null && max == null) return null
  if (min == null) return `≤ ${formatMoney(max as number, currency)}`
  if (max == null) return `từ ${formatMoney(min, currency)}`
  if (min === max) return formatMoney(min, currency)
  return `${formatMoney(min, currency)}–${formatMoney(max, currency)}`
}

/** The amount a budget constrains, expressed as a group total either way. */
export function budgetAsGroupTotal(
  budgetAmount: number,
  budgetMode: BudgetMode,
  participantCount: number,
): number {
  return budgetMode === 'per_person' ? budgetAmount * participantCount : budgetAmount
}
