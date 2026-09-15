import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'

import { viMessages } from '@/shared/i18n/vi'

import { formatMoney } from '../money'
import { planCost, stopCostLabel, type PlanAudience, type PlanCostFacts } from '../plan-cost'

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
  ...overrides,
})
const group = (participantCount: number, budgetMode: PlanAudience['budgetMode'] = 'per_person'): PlanAudience => ({
  roomType: 'group',
  participantCount,
  budgetMode,
})
const couple: PlanAudience = { roomType: 'couple', participantCount: 2, budgetMode: 'total' }

describe('planCost', () => {
  it('keeps a per-person sum per person, and multiplies for the group (PX-9, room of three)', () => {
    const cost = planCost(facts({ costMax: 450_000 }), group(3), t)
    expect(cost.primary).toBe('450k/người')
    expect(cost.secondary).toBe(`${formatMoney(1_350_000)} tổng nhóm 3 người`)
    expect(JSON.stringify(cost)).not.toContain('150k')
    expect(cost.primary).not.toContain('tổng nhóm')
  })

  it('leads with the group figure when the group budget is a total', () => {
    const cost = planCost(facts(), group(4, 'total'), t)
    expect(cost.primary).toBe('1tr tổng nhóm 4 người')
    expect(cost.secondary).toBe('250k/người')
  })

  it('gives a couple one figure for the two of them (PX-9, couple)', () => {
    const cost = planCost(facts({ costMax: 180_000 }), couple, t)
    expect(cost.primary).toBe('360k cho 2 người')
    expect(cost.secondary).toBeNull()
    expect(cost.perPerson).toBe('180k/người')
  })

  it('says there is no price instead of printing 0 (I21)', () => {
    const cost = planCost(facts({ costMax: 0, uncertain: true, priced: false }), group(4), t)
    expect(cost.primary).toBe('Chưa có thông tin giá')
    expect(cost.primary).not.toMatch(/\d/)
    expect(cost.secondary).toBeNull()
    expect(cost.perPerson).toBeNull()
  })

  it('does not stand behind a 0 while a stop price is unknown', () => {
    expect(planCost(facts({ costMax: 0, uncertain: true }), group(4), t).primary).toBe('Chưa có thông tin giá')
  })

  it('calls an all-free plan free', () => {
    expect(planCost(facts({ costMax: 0 }), group(4), t).primary).toBe('Miễn phí')
  })

  it('marks every scope as an estimate while a stop price is uncertain', () => {
    const cost = planCost(facts({ uncertain: true }), group(4), t)
    expect(cost.primary).toBe('~250k/người')
    expect(cost.secondary).toBe('~1tr tổng nhóm 4 người')
  })

  it('keeps a group amount whole: no per-person figure without a division', () => {
    const cost = planCost(facts({ costMax: 800_000, costScope: 'per_group' }), group(4), t)
    expect(cost.primary).toBe('800k tổng nhóm 4 người')
    expect(cost.perPerson).toBeNull()
    expect(cost.secondary).toBeNull()
  })

  it('shows no number for an amount whose scope was never stated', () => {
    expect(planCost(facts({ costScope: null }), group(4), t).primary).toBe('Chưa có thông tin giá')
  })

  it('says only what the API stated while the room is still loading', () => {
    const cost = planCost(facts(), null, t)
    expect(cost.primary).toBe('250k/người')
    expect(cost.secondary).toBeNull()
  })
})

describe('stopCostLabel', () => {
  it('renders a stop price with its unit', () => {
    expect(stopCostLabel({ costMin: 250_000, costMax: 450_000, costScope: 'per_person' }, 'VND', t)).toBe('250k–450k/người')
  })

  it('calls a free stop free', () => {
    expect(stopCostLabel({ costMin: 0, costMax: 0, costScope: 'per_person' }, 'VND', t)).toBe('Miễn phí')
  })

  it('says a stop has no price instead of printing nothing or 0', () => {
    expect(stopCostLabel({ costMin: null, costMax: null, costScope: 'per_person' }, 'VND', t)).toBe('Chưa có thông tin giá')
    expect(stopCostLabel({ costMin: 1, costMax: 2, costScope: null }, 'VND', t)).toBe('Chưa có thông tin giá')
  })
})
