import type { TFunction } from 'i18next'

import type { BudgetMode } from '@/shared/store/roomStore'

import { formatMoney } from './money'

/**
 * APP-037 (#189) — the unit a stored budget is actually in.
 *
 * The label follows `budgetMode` as the API returns it, never the room type
 * alone. A couple room created before #189 holds a `per_person` amount, and
 * calling that "cho 2 người" would restate the same wrong number in friendlier
 * words. Room type only chooses *how a total is phrased*: two people are not a
 * "group".
 */
export function budgetUnitLabel(
  mode: BudgetMode | undefined,
  roomType: 'couple' | 'group',
  t: TFunction,
): string {
  if (mode === 'per_person') return t('datePlan.perPerson')
  return roomType === 'couple' ? t('datePlan.for2') : t('price.groupTotal')
}

/**
 * GoGo-BE#637 — the room budget as one fact on a list card ("800k/người",
 * #293 §3), plus the sentence a screen reader says instead of "800k gạch
 * người".
 *
 * The amount is shown whole and the unit follows the API `mode`: never a
 * total divided into a per-head figure, never a per-head amount relabelled as
 * a total. A total says only "tổng" because the card already states who it is
 * for (the people count sits right before it); the spoken form names the
 * count, so it reads the same for two people or ten. No budget → `null`, and
 * the card omits the fact.
 */
export function budgetFact(
  budget: { mode: BudgetMode; amount: number; currency: string } | undefined,
  participantCount: number,
  t: TFunction,
): { text: string; spoken: string } | null {
  if (!budget) return null
  const amount = formatMoney(budget.amount, budget.currency)
  if (budget.mode === 'per_person') {
    return { text: `${amount}${t('datePlan.perPerson')}`, spoken: t('plans.budgetPerPersonA11y', { amount }) }
  }
  return {
    text: t('plans.budgetTotal', { amount }),
    spoken: t('plans.budgetTotalA11y', { amount, n: participantCount }),
  }
}
