import { z } from 'zod'

// UI bounds for custom VND ceilings. RoomConstraint{,Patch} specifies integer
// minor units >= 0, with no maximum. VND has zero decimal minor units.
export const MIN_CUSTOM_BUDGET = 10_000
export const MAX_CUSTOM_BUDGET = 100_000_000
export const budgetAmountSchema = z.number({ error: 'budgetPicker.required' })
  .int({ error: 'budgetPicker.integer' })
  .min(MIN_CUSTOM_BUDGET, { error: 'budgetPicker.bounds' })
  .max(MAX_CUSTOM_BUDGET, { error: 'budgetPicker.bounds' })
export const budgetPickerSchema = z.object({ budgetAmount: budgetAmountSchema })

export function parseBudgetInput(text: string): number {
  // Dots are VND grouping separators, never a decimal multiplier.
  const digits = text.replace(/\./g, '')
  return /^\d+$/.test(digits) ? Number(digits) : NaN
}

export function formatBudgetInput(amount: number): string {
  return Number.isFinite(amount) ? String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''
}
