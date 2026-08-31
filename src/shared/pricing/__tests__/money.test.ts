import { describe, expect, it } from 'vitest'

import { budgetAsGroupTotal, formatMoney, formatRange, perPerson, toMajorUnits } from '../money'

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

describe('perPerson', () => {
  it('rounds up to the nearest 5k so an estimate never looks exact', () => {
    expect(perPerson(300_000, 4)).toBe(75_000)
    expect(perPerson(310_000, 4)).toBe(80_000)
    expect(perPerson(1_000, 3)).toBe(5_000)
  })

  it('returns the total when the participant count is unusable', () => {
    expect(perPerson(300_000, 0)).toBe(300_000)
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
