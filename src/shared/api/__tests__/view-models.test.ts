import { describe, expect, it } from 'vitest'

import type { PlaceSearchResult, Plan, RoomSummary } from '../types'
import {
  detailToPlaceCard,
  formatDistance,
  formatMinuteOfDay,
  memberProgress,
  openStateFromHours,
  parseApiDate,
  toCandidateCard,
  toNumber,
  toPlaceCard,
  toPlanSummary,
  toRoomAudience,
} from '../view-models'

function searchResult(overrides: Partial<PlaceSearchResult> = {}): PlaceSearchResult {
  return {
    id: 'place-1',
    name: 'Cà phê Đỗ Phủ',
    lat: 10.78,
    lng: 106.69,
    isLodging: false,
    open: { openNow: true, closesAtMinute: 1380 },
    reasonCodes: ['HIGHLY_RATED'],
    confidence: 0.9,
    ...overrides,
  } as PlaceSearchResult
}

describe('toPlaceCard', () => {
  it('carries the per-person price range through in minor units', () => {
    const card = toPlaceCard(
      searchResult({ pricePerPerson: { min: 45_000, max: 90_000, currency: 'VND', confidence: 0.8 } }),
    )

    expect(card.priceMin).toBe(45_000)
    expect(card.priceMax).toBe(90_000)
    expect(card.priceUncertain).toBe(false)
  })

  it('flags a low-confidence price as uncertain', () => {
    const card = toPlaceCard(
      searchResult({ pricePerPerson: { min: 45_000, max: 90_000, currency: 'VND', confidence: 0.3 } }),
    )

    expect(card.priceUncertain).toBe(true)
  })

  it('flags a missing price as uncertain rather than free', () => {
    const card = toPlaceCard(searchResult({ pricePerPerson: undefined }))

    expect(card.priceMin).toBeNull()
    expect(card.priceMax).toBeNull()
    expect(card.priceUncertain).toBe(true)
  })
})

describe('regression: PlaceDetail numerics arrive as strings', () => {
  // Postgres `numeric` columns are serialised as strings by node-postgres, and
  // PlaceDetail passes the raw SQL row straight through — so `rating` is
  // "4.60", not 4.6, even though the contract declares a number. This crashed
  // place detail with `detail.rating.toFixed is not a function`.
  it('coerces string numerics into real numbers', () => {
    const card = detailToPlaceCard({
      id: 'p1',
      name: 'Cà phê Đỗ Phủ',
      rating: '4.60',
      ratingCount: 980,
      lat: '10.7889',
      lng: '106.6903',
      prices: [{ priceMin: '45000', priceMax: '90000', currency: 'VND', confidence: '0.80' }],
    } as never)

    expect(card.rating).toBe(4.6)
    expect(card.rating?.toFixed(1)).toBe('4.6')
    expect(card.lat).toBe(10.7889)
    expect(card.priceMin).toBe(45_000)
    expect(card.priceMax).toBe(90_000)
    // "0.80" must compare as 0.8, not sort as a string below the floor.
    expect(card.priceUncertain).toBe(false)
  })

  it('parses the Postgres timestamp rendering, not just ISO-8601', () => {
    // Rendered on screen as the literal text "Invalid Date" before this.
    const parsed = parseApiDate('2026-08-26 23:40:14.332+00')

    expect(parsed).toBeDefined()
    expect(parsed?.toISOString()).toBe('2026-08-26T23:40:14.332Z')
  })

  it('still parses a proper ISO-8601 timestamp', () => {
    expect(parseApiDate('2026-08-26T23:40:14.332Z')?.toISOString()).toBe('2026-08-26T23:40:14.332Z')
    expect(parseApiDate('2026-08-26T23:40:14.335+00:00')).toBeDefined()
  })

  it('returns nothing for an unusable timestamp instead of an Invalid Date', () => {
    expect(parseApiDate(undefined)).toBeUndefined()
    expect(parseApiDate(null)).toBeUndefined()
    expect(parseApiDate('')).toBeUndefined()
    expect(parseApiDate('not a date')).toBeUndefined()
  })

  it('treats unusable values as absent rather than NaN', () => {
    expect(toNumber(undefined)).toBeUndefined()
    expect(toNumber(null)).toBeUndefined()
    expect(toNumber('')).toBeUndefined()
    expect(toNumber('  ')).toBeUndefined()
    expect(toNumber('not-a-number')).toBeUndefined()
    expect(toNumber(Number.NaN)).toBeUndefined()
    expect(toNumber(0)).toBe(0)
    expect(toNumber('0')).toBe(0)
  })
})

describe('openStateFromHours', () => {
  // 2026-08-27 is a Thursday (day 4).
  const thursdayEvening = new Date(2026, 7, 27, 19, 0)
  const thursdayMorning = new Date(2026, 7, 27, 8, 0)
  const fridayNight = new Date(2026, 7, 28, 1, 0)

  const weekday = [{ dayOfWeek: 4, openMinute: 9 * 60, closeMinute: 22 * 60, isOvernight: false }]

  it('reports open inside the window, with its closing time', () => {
    expect(openStateFromHours(weekday, thursdayEvening)).toEqual({
      openNow: true,
      closesAtMinute: 22 * 60,
    })
  })

  it('reports the next opening when closed earlier the same day', () => {
    expect(openStateFromHours(weekday, thursdayMorning)).toEqual({
      openNow: false,
      opensAtMinute: 9 * 60,
      opensDayOffset: 0,
    })
  })

  it('keeps an overnight session open past midnight, under the previous day', () => {
    // Thursday 18:00–02:00 is still running at 01:00 on Friday.
    const overnight = [{ dayOfWeek: 4, openMinute: 18 * 60, closeMinute: 2 * 60, isOvernight: true }]

    expect(openStateFromHours(overnight, fridayNight)).toEqual({
      openNow: true,
      closesAtMinute: 2 * 60,
    })
  })

  it('does not claim open after an overnight session has ended', () => {
    const overnight = [{ dayOfWeek: 4, openMinute: 18 * 60, closeMinute: 2 * 60, isOvernight: true }]
    const fridayMorning = new Date(2026, 7, 28, 9, 0)

    expect(openStateFromHours(overnight, fridayMorning).openNow).toBe(false)
  })

  it('looks ahead to a later day when today has no hours', () => {
    // Saturday only (day 6), asked on Thursday.
    const weekendOnly = [{ dayOfWeek: 6, openMinute: 10 * 60, closeMinute: 20 * 60, isOvernight: false }]

    expect(openStateFromHours(weekendOnly, thursdayEvening)).toEqual({
      openNow: false,
      opensAtMinute: 10 * 60,
      opensDayOffset: 2,
    })
  })

  it('says nothing rather than guessing when hours are unknown', () => {
    // No hours must never render as "open" (RULE-CORE-008).
    expect(openStateFromHours(undefined, thursdayEvening)).toEqual({ openNow: false })
    expect(openStateFromHours([], thursdayEvening)).toEqual({ openNow: false })
  })
})

describe('formatMinuteOfDay', () => {
  it('renders the contract minute-of-day as a clock time', () => {
    expect(formatMinuteOfDay(0)).toBe('00:00')
    expect(formatMinuteOfDay(420)).toBe('07:00')
    expect(formatMinuteOfDay(1380)).toBe('23:00')
    expect(formatMinuteOfDay(undefined)).toBeNull()
  })
})

describe('formatDistance', () => {
  it('switches from metres to kilometres', () => {
    expect(formatDistance(350)).toBe('400 m')
    expect(formatDistance(1600)).toBe('1,6 km')
    expect(formatDistance(undefined)).toBeNull()
  })
})

describe('toRoomAudience', () => {
  it('derives copy context from the room, not the route', () => {
    const room = {
      id: 'r1',
      type: 'group',
      status: 'collecting',
      decisionMode: 'vote',
      participantCount: 5,
      constraintVersion: 2,
      myRole: 'member',
      constraints: { budgetMode: 'per_person', budgetAmount: 300_000, currency: 'VND' },
    } as RoomSummary

    const audience = toRoomAudience(room, true)

    expect(audience.copyContext).toBe('group')
    expect(audience.participantCount).toBe(5)
    expect(audience.budgetMode).toBe('per_person')
    expect(audience.isHost).toBe(false)
    expect(audience.isGuest).toBe(true)
  })
})

describe('memberProgress', () => {
  it('counts only members who finished picking', () => {
    const room = {
      participantCount: 4,
      members: [
        { id: 'a', displayName: 'A', role: 'host', selectionStatus: 'completed', isGuest: false },
        { id: 'b', displayName: 'B', role: 'member', selectionStatus: 'in_progress', isGuest: true },
        { id: 'c', displayName: 'C', role: 'member', selectionStatus: 'completed', isGuest: true },
      ],
    } as RoomSummary

    expect(memberProgress(room)).toEqual({ completed: 2, total: 3 })
  })

  it('falls back to the expected headcount before anyone joins', () => {
    expect(memberProgress({ participantCount: 4, members: [] } as unknown as RoomSummary)).toEqual({
      completed: 0,
      total: 4,
    })
  })
})

describe('toCandidateCard', () => {
  it('keeps the three strongest score components, highest first', () => {
    const card = toCandidateCard({
      placeId: 'p1',
      name: 'Landmark 81',
      rank: 1,
      score: 0.82,
      components: { budget: 0.4, preferences: 0.9, distance: 0.7, rating: 0.6 },
      reasonCodes: ['FITS_BUDGET'],
      points: 3,
      stale: false,
    })

    expect(card.topComponents.map(component => component.key)).toEqual([
      'preferences',
      'distance',
      'rating',
    ])
  })

  it('fills in safe defaults for a sparse candidate', () => {
    // Every field on SuggestionCandidate is optional in the contract.
    const card = toCandidateCard({})

    expect(card.placeId).toBe('')
    expect(card.reasonCodes).toEqual([])
    expect(card.topComponents).toEqual([])
    expect(card.points).toBe(0)
    expect(card.stale).toBe(false)
  })
})

describe('toPlanSummary', () => {
  it('orders stops by position and preserves the lock flag', () => {
    const plan = {
      id: 'p1',
      roomId: 'r1',
      version: 2,
      totals: { costMin: 100_000, costMax: 400_000, currency: 'VND', overBudget: true, uncertain: false },
      stops: [
        { id: 's2', placeId: 'pl2', position: 2, isLocked: false, status: 'planned' },
        { id: 's1', placeId: 'pl1', position: 1, isLocked: true, status: 'completed' },
      ],
    } as Plan

    const summary = toPlanSummary(plan)

    expect(summary.stops.map(stop => stop.id)).toEqual(['s1', 's2'])
    // A superseded plan must be distinguishable: editing or rebuilding returns
    // a NEW plan and the old one stops accepting writes (PLAN_NOT_CURRENT).
    expect(summary.status).toBe('current')
    expect(summary.stops[0].isLocked).toBe(true)
    // Over-budget comes from the upper bound; never soften it in the adapter.
    expect(summary.overBudget).toBe(true)
  })

  it('reports a superseded plan as superseded', () => {
    expect(toPlanSummary({ id: 'p1', status: 'superseded' } as Plan).status).toBe('superseded')
  })

  it('defaults a plan with no totals to a safe, non-committal summary', () => {
    const summary = toPlanSummary({ id: 'p1', roomId: 'r1' } as Plan)

    expect(summary.stops).toEqual([])
    expect(summary.overBudget).toBe(false)
    expect(summary.currency).toBe('VND')
  })
})
