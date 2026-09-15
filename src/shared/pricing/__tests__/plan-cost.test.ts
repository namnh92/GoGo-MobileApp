import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import type { Plan } from '@/shared/api/types'
import { toPlanSummary } from '@/shared/api/view-models'
import { viMessages } from '@/shared/i18n/vi'

import {
  allScopes,
  costLineText,
  planCost,
  scopeLabel,
  stopCostLabel,
  type PlanAudience,
  type PlanCostFacts,
} from '../plan-cost'

/**
 * GoGo-MobileApp#249 (PX-9; regression #218 I21). Plan amounts are per person
 * (GoGo-BE#593). They were labelled a group total and divided by the people in
 * the room: "450k tổng nhóm · ~150k/người" for 250k–450k per person in a room of
 * three, "180k cho 2 người" for 90k–180k per person, and "0 tổng nhóm · ~0/người"
 * for a plan with no price at all.
 */
const t = ((key: string, options?: Record<string, unknown>) =>
  String(viMessages[key as keyof typeof viMessages] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(options?.[name] ?? ''),
  )) as unknown as TFunction

const facts = (overrides: Partial<PlanCostFacts> = {}): PlanCostFacts => ({
  costMax: 250_000,
  costScope: 'per_person',
  currency: 'VND',
  uncertain: false,
  priced: true,
  hasUnpricedStop: false,
  ...overrides,
})
const group = (participantCount: number, budgetMode: PlanAudience['budgetMode'] = 'per_person'): PlanAudience => ({
  roomType: 'group',
  participantCount,
  budgetMode,
})
const couple: PlanAudience = { roomType: 'couple', participantCount: 2, budgetMode: 'total' }
const text = (line: { amount: string | null; unit: string } | null) => (line ? costLineText(line) : null)

describe('planCost', () => {
  it('keeps a per-person sum per person, and multiplies for the group (PX-9, room of three)', () => {
    const cost = planCost(facts({ costMax: 450_000 }), group(3), t)
    expect(cost.primary).toEqual({ amount: '450k', unit: '/người' })
    expect(text(cost.secondary)).toBe('1,4tr tổng nhóm 3 người')
    expect(JSON.stringify(cost)).not.toContain('150k')
  })

  it('rounds a multiplied group figure up, never down', () => {
    // 335k × 4 = 1.340.000, which the compact style would otherwise print as "1,3tr".
    expect(text(planCost(facts({ costMax: 335_000 }), group(4), t).whole)).toBe('1,4tr tổng nhóm 4 người')
  })

  it('leads with the group figure when the group budget is a total', () => {
    const cost = planCost(facts(), group(4, 'total'), t)
    expect(text(cost.primary)).toBe('1tr tổng nhóm 4 người')
    expect(text(cost.secondary)).toBe('250k/người')
  })

  it('gives a couple one figure for the two of them (PX-9, couple)', () => {
    const cost = planCost(facts({ costMax: 180_000 }), couple, t)
    expect(text(cost.primary)).toBe('360k cho 2 người')
    expect(cost.secondary).toBeNull()
    expect(text(cost.perPerson)).toBe('180k/người')
  })

  it('says there is no price instead of printing 0 (I21)', () => {
    const cost = planCost(facts({ costMax: 0, uncertain: true, priced: false, hasUnpricedStop: true }), group(4), t)
    expect(cost.primary).toEqual({ amount: null, unit: 'Chưa có thông tin giá' })
    expect(cost.secondary).toBeNull()
    expect(cost.perPerson).toBeNull()
  })

  it('never calls a free stop next to an unpriced one a free plan', () => {
    const cost = planCost(facts({ costMax: 0, hasUnpricedStop: true }), group(4), t)
    expect(text(cost.primary)).toBe('Chưa có thông tin giá')
  })

  it('calls an all-free plan free, even when a price is low-confidence', () => {
    expect(text(planCost(facts({ costMax: 0 }), group(4), t).primary)).toBe('Miễn phí')
    expect(text(planCost(facts({ costMax: 0, uncertain: true }), group(4), t).primary)).toBe('Miễn phí')
  })

  it('reads a partly priced plan as a floor, not an estimate', () => {
    const cost = planCost(facts({ hasUnpricedStop: true, uncertain: true }), group(4), t)
    expect(cost.primary).toEqual({ amount: 'từ 250k', unit: '/người' })
    expect(text(cost.secondary)).toBe('từ 1tr tổng nhóm 4 người')
    expect(JSON.stringify(cost)).not.toContain('~')
  })

  it('marks every scope as an estimate while a complete sum has a low-confidence price', () => {
    const cost = planCost(facts({ uncertain: true }), group(4), t)
    expect(text(cost.primary)).toBe('~250k/người')
    expect(text(cost.secondary)).toBe('~1tr tổng nhóm 4 người')
  })

  it('keeps a group amount whole: no per-person figure without a division', () => {
    const cost = planCost(facts({ costMax: 800_000, costScope: 'per_group' }), group(4), t)
    expect(text(cost.primary)).toBe('800k tổng nhóm 4 người')
    expect(cost.perPerson).toBeNull()
    expect(cost.secondary).toBeNull()
  })

  it('shows no number for an amount whose scope was never stated', () => {
    expect(text(planCost(facts({ costScope: null }), group(4), t).primary)).toBe('Chưa có thông tin giá')
  })

  it('says only what the API stated while the room is still loading', () => {
    const cost = planCost(facts(), null, t)
    expect(text(cost.primary)).toBe('250k/người')
    expect(cost.secondary).toBeNull()
  })
})

describe('a plan stored before GoGo-BE#593 (uncertain: false, one stop unpriced)', () => {
  const legacy = (stops: Array<{ costMin: number | null; costMax: number | null }>) =>
    toPlanSummary({
      id: 'p1',
      roomId: 'r1',
      totals: { costMin: 250_000, costMax: 250_000, costScope: 'per_person', currency: 'VND', uncertain: false },
      stops: stops.map((stop, position) => ({ id: `s${position}`, placeId: `pl${position}`, position, costScope: 'per_person', ...stop })),
    } as Plan)

  it('reads the known sum as a floor', () => {
    const summary = legacy([{ costMin: 250_000, costMax: 250_000 }, { costMin: null, costMax: null }])
    expect(summary.hasUnpricedStop).toBe(true)
    expect(text(planCost(summary, group(4), t).primary)).toBe('từ 250k/người')
  })

  it('never reads a free stop plus an unpriced one as free', () => {
    const summary = { ...legacy([{ costMin: 0, costMax: 0 }, { costMin: null, costMax: null }]), costMax: 0 }
    expect(text(planCost(summary, group(4), t).primary)).toBe('Chưa có thông tin giá')
  })
})

describe('allScopes', () => {
  it('gives a group both figures, leading one first', () => {
    expect(allScopes(planCost(facts(), group(4), t)).map(costLineText)).toEqual(['250k/người', '1tr tổng nhóm 4 người'])
  })

  it('gives a couple the figure for two and the per-person figure', () => {
    expect(allScopes(planCost(facts({ costMax: 180_000 }), couple, t)).map(costLineText)).toEqual([
      '360k cho 2 người',
      '180k/người',
    ])
  })

  it('gives a plan with no price one line', () => {
    expect(allScopes(planCost(facts({ priced: false }), group(4), t)).map(costLineText)).toEqual(['Chưa có thông tin giá'])
  })
})

describe('scopeLabel', () => {
  it('turns a scope into a label', () => {
    expect(scopeLabel({ amount: '1tr', unit: ' tổng nhóm 4 người' })).toBe('Tổng nhóm 4 người')
  })
})

describe('stopCostLabel', () => {
  it('renders a stop price with its unit', () => {
    expect(stopCostLabel({ costMin: 250_000, costMax: 450_000, costScope: 'per_person' }, 'VND', t)).toBe('250k–450k/người')
  })

  it('reads a range that starts at 0 as an upper bound', () => {
    expect(stopCostLabel({ costMin: 0, costMax: 50_000, costScope: 'per_person' }, 'VND', t)).toBe('≤ 50k/người')
  })

  it('calls a free stop free', () => {
    expect(stopCostLabel({ costMin: 0, costMax: 0, costScope: 'per_person' }, 'VND', t)).toBe('Miễn phí')
  })

  it('says a stop has no price instead of printing nothing or 0', () => {
    expect(stopCostLabel({ costMin: null, costMax: null, costScope: 'per_person' }, 'VND', t)).toBe('Chưa có thông tin giá')
    expect(stopCostLabel({ costMin: 1, costMax: 2, costScope: null }, 'VND', t)).toBe('Chưa có thông tin giá')
  })
})
