import { budgetModeFor, type BudgetMode, type DemoAudience } from '@/shared/store/roomStore'

/** Search prices are per person; round a total down to stay inside its ceiling. */
export function pickerBudgetCeiling(draft: { audience: DemoAudience; budgetMode: BudgetMode; budgetAmount: number | null; participantCount: number }): number | undefined {
  const count = draft.audience === 'couple' ? 2 : draft.participantCount
  const amount = draft.budgetAmount
  return amount != null && Number.isFinite(amount) && amount > 0 && count > 0
    ? budgetModeFor(draft.audience, draft.budgetMode) === 'total' ? Math.floor(amount / count) : amount
    : undefined
}
