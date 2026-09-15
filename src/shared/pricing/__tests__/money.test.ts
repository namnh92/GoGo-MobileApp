import { describe, expect, it } from 'vitest'

import * as money from '../money'
import { budgetAsGroupTotal, formatMoney, formatRange, toMajorUnits } from '../money'

describe('minor units', () => {
  it('treats VND as a zero-decimal currency', () => {
    expect(toMajorUnits(450_000, 'VND')).toBe(450_000)
    expect(toMajorUnits(450_000, 'USD')).toBe(4_500)
  })
})

describe('formatMoney', () => {
  it('renders thousands and millions the way the screens read them', () => {
    expect(formatMoney(450_000)).toBe('450k')
    expect(formatMoney(1_000_000)).toBe('1tr')
    expect(formatMoney(1_200_000)).toBe('1,2tr')
    expect(formatMoney(800)).toBe('800')
  })
})

describe('no divisor (RULE-CORE-013, GoGo-MobileApp#249)', () => {
  it('offers no way to divide an amount by the people in a room', () => {
    // Dividing a per-person sum again is how "450k tổng nhóm · ~150k/người" was printed.
    expect(Object.keys(money)).not.toContain('perPerson')
  })
})

describe('formatRange', () => {
  it('keeps an open-ended range visibly uncertain', () => {
    expect(formatRange(100_000, 200_000)).toBe('100k–200k')
    expect(formatRange(100_000, 100_000)).toBe('100k')
    expect(formatRange(null, 200_000)).toBe('≤ 200k')
    expect(formatRange(100_000, null)).toBe('từ 100k')
    expect(formatRange(null, null)).toBeNull()
  })
})

describe('budgetAsGroupTotal', () => {
  it('scales a per-person budget by the headcount', () => {
    expect(budgetAsGroupTotal(300_000, 'per_person', 4)).toBe(1_200_000)
    expect(budgetAsGroupTotal(300_000, 'total', 4)).toBe(300_000)
  })
})
