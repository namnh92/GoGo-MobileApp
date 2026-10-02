import { describe, expect, it } from 'vitest'

import { budgetFact, budgetUnitLabel } from '../budget-unit'

/**
 * APP-037 (#189) — the label follows the stored `budgetMode`, including for a
 * couple room created before the fix. Restating a per-person amount as "cho 2
 * người" would dress the wrong number in friendlier words.
 */
const t = ((key: string) => key) as unknown as Parameters<typeof budgetUnitLabel>[2]

describe('budgetUnitLabel', () => {
  it('says per person whenever the stored mode is per_person', () => {
    expect(budgetUnitLabel('per_person', 'group', t)).toBe('datePlan.perPerson')
    // Legacy couple rooms: the amount really is per head, so say so.
    expect(budgetUnitLabel('per_person', 'couple', t)).toBe('datePlan.perPerson')
  })

  it('phrases a total by room type', () => {
    expect(budgetUnitLabel('total', 'couple', t)).toBe('datePlan.for2')
    expect(budgetUnitLabel('total', 'group', t)).toBe('price.groupTotal')
  })

  it('treats a missing mode as a total rather than inventing a per-head number', () => {
    expect(budgetUnitLabel(undefined, 'couple', t)).toBe('datePlan.for2')
    expect(budgetUnitLabel(undefined, 'group', t)).toBe('price.groupTotal')
  })
})

/** GoGo-BE#637 — the list-card budget fact: whole amount, unit from `mode`. */
describe('budgetFact', () => {
  const tx = ((key: string, opts?: Record<string, unknown>) =>
    opts ? `${key}(${Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(',')})` : key) as unknown as Parameters<typeof budgetFact>[2]

  it('per_person: amount + per-person unit, never multiplied', () => {
    expect(budgetFact({ mode: 'per_person', amount: 800000, currency: 'VND' }, 4, tx)).toEqual({
      text: '800kdatePlan.perPerson',
      spoken: 'plans.budgetPerPersonA11y(amount=800k)',
    })
  })

  it('total: the whole amount says it is a total, never divided by the people count', () => {
    expect(budgetFact({ mode: 'total', amount: 2000000, currency: 'VND' }, 4, tx)).toEqual({
      text: 'plans.budgetTotal(amount=2tr)',
      spoken: 'plans.budgetTotalA11y(amount=2tr,n=4)',
    })
  })

  it('absent: no fact at all', () => {
    expect(budgetFact(undefined, 4, tx)).toBeNull()
  })
})
