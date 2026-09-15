import type { TFunction } from 'i18next'

import type { BudgetScope } from '@/shared/api/types'
import type { RoomAudience } from '@/shared/api/view-models'

import { formatMoney, formatRange } from './money'

/**
 * GoGo-MobileApp#249 — the one formatter for what a plan costs (spec §16.1,
 * §23.3; RULE-CORE-004, RULE-CORE-013).
 *
 * Plan amounts arrive with the scope they are in (`costScope`, GoGo-BE#593):
 * today each stop's per-person price, summed. The other scope is reached by
 * multiplying a per-person amount by the people in the room — never by
 * dividing — so a per-person sum can no longer be printed as a group total and
 * then split again. An amount whose scope was not stated is not shown as a
 * number at all: assuming per person is exactly the defect.
 */

export type PlanAudience = Pick<RoomAudience, 'roomType' | 'participantCount' | 'budgetMode'>

export interface PlanCostFacts {
  costMax: number
  costScope: BudgetScope | null
  currency: string
  /** A stop's price is unknown or low-confidence: every amount reads `~`. */
  uncertain: boolean
  /** At least one stop has a price in `costScope`. */
  priced: boolean
}

export interface PlanCost {
  /** The per-person amount with its unit, when the API stated one. */
  perPerson: string | null
  /** The whole room's amount with its scope: "cho 2 người", "tổng nhóm 4 người". */
  whole: string | null
  /** The line to lead with (spec §23.3) — always scoped, or the words for no price. */
  primary: string
  /** The other scope, for a group. */
  secondary: string | null
}

export function planCost(plan: PlanCostFacts, audience: PlanAudience | null, t: TFunction): PlanCost {
  const only = (line: string): PlanCost => ({ perPerson: null, whole: null, primary: line, secondary: null })

  // No stop has a price, or the scope is unknown (a plan cached before the
  // contract stated it): there is no number to stand behind — never "0".
  if (!plan.priced || plan.costScope === null) return only(t('price.unit.unknown'))
  if (plan.costMax === 0) return only(t(plan.uncertain ? 'price.unit.unknown' : 'price.unit.free'))

  const approx = plan.uncertain ? '~' : ''
  const amount = (value: number) => `${approx}${formatMoney(value, plan.currency)}`
  const people = audience && audience.participantCount > 0 ? audience : null

  if (plan.costScope === 'per_group') {
    // A group amount cannot become a per-person one without dividing.
    const whole = `${amount(plan.costMax)} ${wholeLabel(people, t)}`
    return { perPerson: null, whole, primary: whole, secondary: null }
  }

  const perPerson = `${amount(plan.costMax)}${t('price.unit.per_person')}`
  // The room has not loaded: say only what the API said.
  if (!people) return { perPerson, whole: null, primary: perPerson, secondary: null }

  const whole = `${amount(plan.costMax * people.participantCount)} ${wholeLabel(people, t)}`
  // A couple reads one figure for the two of them (spec §16.1).
  if (people.roomType === 'couple') return { perPerson, whole, primary: whole, secondary: null }
  // A group leads with the scope its budget was set in (spec §23.3).
  return people.budgetMode === 'total'
    ? { perPerson, whole, primary: whole, secondary: perPerson }
    : { perPerson, whole, primary: perPerson, secondary: whole }
}

function wholeLabel(audience: PlanAudience | null, t: TFunction): string {
  if (!audience) return t('price.groupTotal')
  return audience.roomType === 'couple'
    ? t('datePlan.for2')
    : t('price.groupTotalOf', { n: audience.participantCount })
}

export interface StopCostFacts {
  costMin: number | null
  costMax: number | null
  costScope: BudgetScope | null
}

/** One stop's price with its unit, `Miễn phí`, or `Chưa có thông tin giá` — never a bare number. */
export function stopCostLabel(stop: StopCostFacts, currency: string, t: TFunction): string {
  const range = stop.costScope === null ? null : formatRange(stop.costMin, stop.costMax, currency)
  if (range === null) return t('price.unit.unknown')
  if (stop.costMin === 0 && stop.costMax === 0) return t('price.unit.free')
  return `${range}${t(stop.costScope === 'per_group' ? 'price.unit.per_group' : 'price.unit.per_person')}`
}
