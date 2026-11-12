import { describe, expect, it } from 'vitest'
import { budgetAmountSchema, formatBudgetInput, parseBudgetInput } from '../budget-picker'

describe('custom VND budget ceiling', () => {
  it('groups and parses whole dong without multiplying by 100', () => {
    expect(formatBudgetInput(650000)).toBe('650.000')
    expect(parseBudgetInput('650.000')).toBe(650000)
    expect(parseBudgetInput('')).toBeNaN()
    expect(parseBudgetInput('-650000')).toBeNaN()
    expect(parseBudgetInput('650,50')).toBeNaN()
  })
  it.each([NaN, 0, -1, 9999, 650000.5, 100000001, Infinity])('rejects invalid custom ceiling %s', amount => {
    expect(budgetAmountSchema.safeParse(amount).success).toBe(false)
  })
  it.each([10000, 650000, 100000000])('accepts ceiling %i', amount => {
    expect(budgetAmountSchema.parse(amount)).toBe(amount)
  })
})

it.each(['650000', '650.000', '650.000đ', '650,000'])('F-14 accepts whole VND paste %s', text => {
  expect(parseBudgetInput(text)).toBe(650000)
})
it.each(['650000.50', '650.000,50', '650,000.50', '650,50', '650x000', '650.00', '650..000'])('F-14 rejects decimal or malformed paste %s', text => {
  expect(parseBudgetInput(text)).toBeNaN()
})
