import { describe, expect, it } from 'vitest'
import {
  draftEnrichment,
  emptyContribution,
  priceValid,
  resumeContribution,
  stepValid,
  submissionEnrichment,
} from './contribution-form'

const complete = () => ({
  ...emptyContribution(),
  purposeKeys: ['date'],
  vibeKeys: ['quiet'],
  serviceRating: 4,
  spaceRating: 3,
})
describe('#518 contribution contract', () => {
  it('starts empty with no sample progress, price, rating or photos', () => {
    const form = emptyContribution()
    expect(draftEnrichment(form)).toEqual({})
    expect([1, 2, 3].map((step) => stepValid(form, step))).toEqual([false, false, false])
    expect(submissionEnrichment(form)).toBeUndefined()
  })
  it('requires purposes, 1–3 vibes, and two separate integer ratings', () => {
    expect(submissionEnrichment(complete())).toEqual({
      purposeKeys: ['date'],
      vibeKeys: ['quiet'],
      service: { rating: 4, chipKeys: [] },
      space: { rating: 3, chipKeys: [] },
    })
    for (const overrides of [
      { purposeKeys: [] },
      { vibeKeys: [] },
      { vibeKeys: ['a', 'b', 'c', 'd'] },
      { serviceRating: 0 },
      { spaceRating: 6 },
      { spaceRating: 1.5 },
    ])
      expect(submissionEnrichment({ ...complete(), ...overrides })).toBeUndefined()
  })
  it.each(['-1', '1.2', '50k', '1e3', '9007199254740992', ''])('rejects invalid VND minor units %s', (min) => {
    expect(priceValid({ ...complete(), priceKnown: true, min, max: '100000' })).toBe(false)
  })
  it('keeps actual minor units and their selected scope without multiplying or dividing', () => {
    expect(
      draftEnrichment({ ...complete(), priceKnown: true, min: '50000', max: '100000', unit: 'per_group' }).price,
    ).toEqual({ min: 50000, max: 100000, currency: 'VND', unit: 'per_group' })
    expect(priceValid({ ...complete(), priceKnown: true, min: '100001', max: '100000' })).toBe(false)
    expect(draftEnrichment({ ...complete(), priceKnown: true, unit: 'free' }).price).toEqual({
      min: 0,
      max: 0,
      currency: 'VND',
      unit: 'free',
    })
    expect(draftEnrichment({ ...complete(), min: '50000', max: '100000' })).not.toHaveProperty('price')
  })
  it('round trips partial user claims without manufacturing unknown amenities or local photo attachments', () => {
    const enrichment = {
      amenities: { car_parking: false, pets_allowed: true },
      recommendedDishes: 'Cake',
      visitTips: 'Morning',
      service: { rating: 2, chipKeys: ['service_friendly'] },
    }
    expect(draftEnrichment(resumeContribution(enrichment))).toEqual(enrichment)
    expect(JSON.stringify(draftEnrichment(complete()))).not.toMatch(/photo|token|Google|file:/)
  })
})
