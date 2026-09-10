import type { TFunction } from 'i18next'

import type { BudgetMode } from '@/shared/store/roomStore'

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
