import { z } from 'zod'

// UI bounds for custom VND ceilings. RoomConstraint{,Patch} specifies integer
// minor units >= 0, with no maximum. VND has zero decimal minor units.
export const MIN_CUSTOM_BUDGET = 10_000
export const MAX_CUSTOM_BUDGET = 100_000_000
export const budgetAmountSchema = z.number({ error: issue => typeof issue.input === 'number' && Number.isNaN(issue.input)
  ? 'budgetPicker.format' : 'budgetPicker.required' })
  .int({ error: 'budgetPicker.integer' })
  .min(MIN_CUSTOM_BUDGET, { error: 'budgetPicker.bounds' })
  .max(MAX_CUSTOM_BUDGET, { error: 'budgetPicker.bounds' })
export const budgetPickerSchema = z.object({ budgetAmount: budgetAmountSchema })

export function parseBudgetInput(text: string): number {
  const input = text.trim().replace(/(?:đ|₫|vnd)$/iu, '').trim()
  // A separator must group exactly three digits. Mixed separators and decimal
  // tails must never turn into a larger integer by stripping punctuation.
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+|\d{1,3}(?:,\d{3})+)$/.test(input)) return NaN
  return Number(input.replace(/[.,]/g, ''))
}

export function formatBudgetInput(amount: number | null): string {
  return amount !== null && Number.isFinite(amount) ? String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''
}
