import { describe, expect, it } from 'vitest'

import {
  helpfulDelta,
  isHelpfulFallback,
  isMarkedHelpful,
  withHelpfulDelta,
  withMyMark,
  withServerState,
} from '../review-reactions'
import type { PlaceReviewPreview } from '../types'

const review = (id: string, helpfulCount: number) => ({
  id,
  rating: 5,
  createdAt: '2026-09-14T05:00:00.000Z',
  author: { displayName: 'Lan' },
  helpfulCount,
})

const preview = (order: 'latest' | 'helpful', ...reviews: ReturnType<typeof review>[]): PlaceReviewPreview => ({
  source: 'gogo',
  order,
  reviews,
})

describe('optimistic helpful marks (APP-060)', () => {
  it('counts a new mark once and a second identical tap not at all', () => {
    const mine = withMyMark(undefined, 'p1', 'r1', true)
    expect(isMarkedHelpful(mine, 'r1')).toBe(true)
    expect(helpfulDelta(undefined, 'r1', true)).toBe(1)
    expect(helpfulDelta(mine, 'r1', true)).toBe(0)
    expect(helpfulDelta(mine, 'r1', false)).toBe(-1)
    expect(helpfulDelta(undefined, 'r1', false)).toBe(0)
  })

  it('moves only the tapped review, and never below zero', () => {
    const before = preview('latest', review('r1', 2), review('r2', 0))
    expect(withHelpfulDelta(before, 'r1', 1)?.reviews.map(r => r.helpfulCount)).toEqual([3, 0])
    expect(withHelpfulDelta(before, 'r2', -1)?.reviews.map(r => r.helpfulCount)).toEqual([2, 0])
    expect(withHelpfulDelta(before, 'r1', 0)).toBe(before)
    expect(withHelpfulDelta(undefined, 'r1', 1)).toBeUndefined()
  })

  it("replaces a guess with the server's count", () => {
    const guessed = preview('helpful', review('r1', 3))
    const settled = withServerState(guessed, { reviewId: 'r1', helpfulCount: 7, reactedByMe: true })
    expect(settled?.reviews[0]?.helpfulCount).toBe(7)
  })

  it('keeps one entry per review in my marks', () => {
    const twice = withMyMark(withMyMark(undefined, 'p1', 'r1', true), 'p1', 'r1', true)
    expect(twice).toEqual({ placeId: 'p1', helpful: ['r1'] })
    expect(withMyMark(twice, 'p1', 'r1', false)).toEqual({ placeId: 'p1', helpful: [] })
  })

  it('recognises the newest-first fallback only in the helpful order with no marks', () => {
    expect(isHelpfulFallback(preview('helpful', review('r1', 0), review('r2', 0)))).toBe(true)
    expect(isHelpfulFallback(preview('helpful', review('r1', 1), review('r2', 0)))).toBe(false)
    expect(isHelpfulFallback(preview('latest', review('r1', 0)))).toBe(false)
    expect(isHelpfulFallback(preview('helpful'))).toBe(false)
    expect(isHelpfulFallback(undefined)).toBe(false)
  })
})
