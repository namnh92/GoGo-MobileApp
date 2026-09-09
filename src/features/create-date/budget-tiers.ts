/**
 * Budget tiers the wizard offers. The contract wants one integer in minor units
 * (RULE-CORE-004), so each tier carries the upper bound it represents; the
 * label states the range and the scope comes from `budgetMode`.
 *
 * Keys are stable — only the labels are localised.
 */
export interface BudgetTier {
  key: string
  /** Upper bound in integer minor units, interpreted per `budgetMode`. */
  amount: number
}

/** "Doesn't matter" still needs a number; this is a deliberately generous cap. */
export const FLEXIBLE_BUDGET = 5_000_000

export const BUDGET_TIERS: readonly BudgetTier[] = [
  { key: 'under300', amount: 300_000 },
  { key: 'to500', amount: 500_000 },
  { key: 'to800', amount: 800_000 },
  { key: 'to1500', amount: 1_500_000 },
  { key: 'flexible', amount: FLEXIBLE_BUDGET },
] as const

export const DEFAULT_BUDGET_TIER = BUDGET_TIERS[2]

/**
 * The tier a per-person amount falls into: the first whose upper bound covers
 * it, or the open-ended one. A profile stores an amount (ADR-0022); the wizard
 * offers tiers, so a default has to be mapped rather than matched.
 */
export function tierForAmount(perPerson: number): BudgetTier {
  return BUDGET_TIERS.find(tier => tier.amount >= perPerson) ?? BUDGET_TIERS[BUDGET_TIERS.length - 1]!
}
