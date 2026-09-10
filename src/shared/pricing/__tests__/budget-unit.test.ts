import { describe, expect, it } from 'vitest'

import { budgetUnitLabel } from '../budget-unit'

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
