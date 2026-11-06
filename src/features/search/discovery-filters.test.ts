import { describe, expect, it } from 'vitest'
import { emptyFilters, filterParams, validateFilters } from './discovery-filters'

describe('staged discovery filter contract', () => {
  it('starts neutral and keeps zero as a valid per-person price', () => {
    expect(filterParams(emptyFilters())).toEqual({})
    expect(filterParams({ ...emptyFilters(), priceFrom: '0', priceTo: '200', openNow: true, categories: ['cafe'] })).toEqual({ priceMinPerPerson: 0, priceMaxPerPerson: 200000, openAt: 'now', categories: 'cafe' })
  })
  it.each([['-1', '200'], ['abc', '200'], ['Infinity', '200'], ['201', '200']])('rejects invalid bounds %s–%s', (priceFrom, priceTo) => {
    expect(validateFilters({ ...emptyFilters(), priceFrom, priceTo })).toBe(false)
  })
  it('converts fractional thousands into integer VND', () => {
    expect(filterParams({ ...emptyFilters(), priceFrom: '12,5' }).priceMinPerPerson).toBe(12500)
  })
})
