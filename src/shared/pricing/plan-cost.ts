import type { TFunction } from 'i18next'

import type { BudgetScope } from '@/shared/api/types'
import type { RoomAudience } from '@/shared/api/view-models'

import { formatMoney, formatRange } from './money'

/**
 * GoGo-MobileApp#249 — the one formatter for what a plan costs (spec §16.1,
 * §23.3, §36.2; RULE-CORE-004, RULE-CORE-013).
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
  /** Sum of the stops' lower bounds, in `costScope`. */
  costMin: number
  /** Sum of the stops' upper bounds, in `costScope`. */
  costMax: number
  costScope: BudgetScope | null
  currency: string
  /** A stop's price is low-confidence: a complete amount reads `~`. */
  uncertain: boolean
  /** At least one stop has a price in `costScope`. */
  priced: boolean
  /** At least one stop has no price in `costScope`, so only a floor is known. */
  hasUnpricedStop: boolean
}

/**
 * An amount and what it is per, kept apart so a screen can set the scope in its
 * own style, with its own spacing, without truncating it. `amount` is null when
 * there is no number to show; `unit` is then the whole line (`Miễn phí`,
 * `Chưa có thông tin giá`). `unit` carries no leading space.
 */
export interface CostLine {
  amount: string | null
  unit: string
}

export interface PlanCost {
  /** The per-person amount, when the API stated one. */
  perPerson: CostLine | null
  /** The whole room's amount: "cho 2 người", "tổng nhóm 4 người". */
  whole: CostLine | null
  /** The line to lead with (spec §23.3) — always scoped, or the words for no price. */
  primary: CostLine
  /** The other scope, for a group. */
  secondary: CostLine | null
}

/** One line of text: a "/người" suffix sits against the amount, a scope after a space. */
export function costLineText(line: CostLine): string {
  if (line.amount === null) return line.unit
  return line.unit.startsWith('/') ? `${line.amount}${line.unit}` : `${line.amount} ${line.unit}`
}

/** A scope as a label on its own: "tổng nhóm 4 người" → "Tổng nhóm 4 người". */
export function scopeLabel(line: CostLine): string {
  const unit = line.unit.trim()
  return unit.charAt(0).toLocaleUpperCase() + unit.slice(1)
}

/**
 * Every scope the amount has, the leading one first. Where a screen has room
 * for one line only, spec §36.2 still wants the per-person figure and the group
 * figure together.
 */
export function allScopes(cost: PlanCost): CostLine[] {
  const other = cost.secondary ?? (cost.primary === cost.whole ? cost.perPerson : cost.whole)
  return other && other !== cost.primary ? [cost.primary, other] : [cost.primary]
}

export function planCost(plan: PlanCostFacts, audience: PlanAudience | null, t: TFunction): PlanCost {
  const only = (unit: string): PlanCost => {
    const line = { amount: null, unit }
    return { perPerson: null, whole: null, primary: line, secondary: null }
  }

  // No stop has a price, or the scope is unknown (a plan cached before the
  // contract stated it): there is no number to stand behind — never "0".
  if (!plan.priced || plan.costScope === null) return only(t('price.unit.unknown'))
  // Free only when every stop is known to be free; a free stop next to an
  // unpriced one is not a free plan. Low confidence does not unmake "free".
  if (plan.costMax === 0) return only(t(plan.hasUnpricedStop ? 'price.unit.unknown' : 'price.unit.free'))

  // A stop with no price leaves only a floor: the sum of the known LOWER bounds,
  // read the way `formatRange` reads an open range ("từ …"). A floor of nothing
  // says nothing about the price, so it is not shown as a number.
  const floor = plan.hasUnpricedStop
  if (floor && plan.costMin <= 0) return only(t('price.unit.unknown'))
  const base = floor ? plan.costMin : plan.costMax
  const amount = (value: number) => {
    // A floor rounds down and an estimate rounds up, so neither ever reads as
    // more certain in the direction a person budgets for.
    const money = formatMoney(roundForDisplay(value, plan.currency, floor ? 'down' : 'up'), plan.currency)
    if (floor) return t('price.atLeast', { amount: money })
    return plan.uncertain ? `~${money}` : money
  }
  const people = audience && audience.participantCount > 0 ? audience : null

  if (plan.costScope === 'per_group') {
    // A group amount cannot become a per-person one without dividing.
    const whole = { amount: amount(base), unit: wholeLabel(people, t) }
    return { perPerson: null, whole, primary: whole, secondary: null }
  }

  const perPerson = { amount: amount(base), unit: t('price.unit.per_person') }
  // The room has not loaded: say only what the API said.
  if (!people) return { perPerson, whole: null, primary: perPerson, secondary: null }

  const whole = { amount: amount(base * people.participantCount), unit: wholeLabel(people, t) }
  // A couple reads one figure for the two of them (spec §16.1).
  if (people.roomType === 'couple') return { perPerson, whole, primary: whole, secondary: null }
  // A group leads with the scope its budget was set in (spec §23.3).
  return people.budgetMode === 'total'
    ? { perPerson, whole, primary: whole, secondary: perPerson }
    : { perPerson, whole, primary: perPerson, secondary: whole }
}

/**
 * The compact VND style shows thousands, or tenths of a million, and on its own
 * rounds to the nearest. Rounding to what the display can show first, in a
 * chosen direction, keeps an estimate from reading as less than it is ("1,3tr"
 * for 1.340.000) and a floor from reading as more.
 */
function roundForDisplay(amount: number, currency: string, direction: 'up' | 'down'): number {
  if (currency.toUpperCase() !== 'VND') return amount
  const step = amount >= 1_000_000 ? 100_000 : amount >= 1_000 ? 1_000 : 1
  const round = direction === 'up' ? Math.ceil : Math.floor
  return round(amount / step) * step
}

function wholeLabel(audience: PlanAudience | null, t: TFunction): string {
  if (!audience) return t('price.groupTotal')
  // Built from the count the API reported, never from a fixed "2".
  return audience.roomType === 'couple'
    ? t('price.forPeople', { n: audience.participantCount })
    : t('price.groupTotalOf', { n: audience.participantCount })
}

export interface StopCostFacts {
  costMin: number | null
  costMax: number | null
  costScope: BudgetScope | null
}

/** One stop's price with its unit, `Miễn phí`, or `Chưa có thông tin giá` — never a bare number. */
export function stopCostLabel(stop: StopCostFacts, currency: string, t: TFunction): string {
  if (stop.costScope === null || (stop.costMin === null && stop.costMax === null)) {
    return t('price.unit.unknown')
  }
  if (stop.costMin === 0 && stop.costMax === 0) return t('price.unit.free')
  // A range that starts at nothing is an upper bound: "≤ 50k", not "0–50k".
  const range =
    stop.costMin === 0 && stop.costMax !== null
      ? formatRange(null, stop.costMax, currency)
      : formatRange(stop.costMin, stop.costMax, currency)
  return `${range}${t(stop.costScope === 'per_group' ? 'price.unit.per_group' : 'price.unit.per_person')}`
}
