import { describe, expect, it } from 'vitest'

import type { PlaceSearchResult, Plan, RoomSummary } from '../types'
import {
  detailToPlaceCard,
  formatCountVi,
  formatDistance,
  formatMinuteOfDay,
  formatRatingVi,
  memberProgress,
  openStateFromHours,
  parseApiDate,
  placeCardMetaLine,
  placeCardRatingPriceLine,
  type PlaceCard,
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

describe('toPlanSummary × cost scope (GoGo-MobileApp#249)', () => {
  it('carries the scope of every plan cost, and knows when no stop has a price', () => {
    const summary = toPlanSummary({
      id: 'p1',
      roomId: 'r1',
      totals: { costMin: 0, costMax: 0, costScope: 'per_person', currency: 'VND', uncertain: true },
      stops: [
        { id: 's1', placeId: 'pl1', position: 0, costMin: null, costMax: null, costScope: 'per_person', status: 'planned' },
      ],
    } as Plan)
    expect(summary.costScope).toBe('per_person')
    expect(summary.stops[0].costScope).toBe('per_person')
    expect(summary.priced).toBe(false)
    expect(summary.hasUnpricedStop).toBe(true)
  })

  it('invents no scope for a plan cached before the contract stated one', () => {
    const summary = toPlanSummary({
      id: 'p1',
      totals: { costMin: 100_000, costMax: 200_000 },
      stops: [{ id: 's1', position: 0, costMin: 100_000, costMax: 200_000 }],
    } as Plan)
    expect(summary.costScope).toBeNull()
    expect(summary.stops[0].costScope).toBeNull()
    expect(summary.priced).toBe(true)
    expect(summary.hasUnpricedStop).toBe(false)
  })
})

describe('PlaceCard lines (#295, #293 §3)', () => {
  const card = (overrides: Partial<PlaceCard> = {}): PlaceCard =>
    ({
      id: 'p1',
      name: 'Cà phê Đỗ Phủ',
      addressText: '12 Nguyễn Huệ',
      distanceM: 2100,
      rating: 4.6,
      ratingCount: 980,
      priceMin: 45000,
      priceMax: 90000,
      currency: 'VND',
      priceUncertain: false,
      priceUnit: 'per_person',
      isLodging: false,
      reasonCodes: [],
      photoUrl: null,
      photoAttribution: null,
      ...overrides,
    }) as PlaceCard
  const units = (unit: string) =>
    ({ per_person: '/người', per_hour: '/giờ', free: 'Miễn phí', unknown: 'Chưa có thông tin giá' })[unit] ?? `?${unit}`

  it('formats ratings and counts the Vietnamese way', () => {
    expect(formatRatingVi(4.6)).toBe('4,6')
    expect(formatRatingVi(5)).toBe('5,0')
    expect(formatCountVi(980)).toBe('980')
    expect(formatCountVi(1234)).toBe('1.234')
    expect(formatCountVi(12000)).toBe('12.000')
    expect(formatCountVi(1234567)).toBe('1.234.567')
  })

  it('meta line: category · area · distance, each omitted without a fact', () => {
    expect(placeCardMetaLine(card(), 'Cà phê')).toBe('Cà phê · 12 Nguyễn Huệ · 2,1 km')
    expect(placeCardMetaLine(card(), null)).toBe('12 Nguyễn Huệ · 2,1 km')
    expect(placeCardMetaLine(card({ distanceM: undefined }), 'Cà phê')).toBe('Cà phê · 12 Nguyễn Huệ')
    expect(placeCardMetaLine(card({ addressText: undefined, distanceM: undefined }), null)).toBeNull()
  })

  it('rating · price: parts, with the unit always on the price and no source word', () => {
    expect(placeCardRatingPriceLine(card(), units)).toEqual({
      rating: { score: '4,6', count: '980' },
      price: '45k–90k/người',
    })
  })

  it('omits the count it does not have, and the rating it does not have', () => {
    expect(placeCardRatingPriceLine(card({ ratingCount: undefined }), units).rating).toEqual({ score: '4,6', count: null })
    expect(placeCardRatingPriceLine(card({ rating: undefined }), units).rating).toBeNull()
  })

  it('free and unknown are the whole price part — never an amount with no unit', () => {
    expect(placeCardRatingPriceLine(card({ priceUnit: 'free' }), units).price).toBe('Miễn phí')
    expect(placeCardRatingPriceLine(card({ priceMin: null, priceMax: null }), units).price).toBe('Chưa có thông tin giá')
    // A range whose scope nobody stated is not a price anyone can act on —
    // "45k–90k" with no unit is what RULE-CORE-013 forbids.
    expect(placeCardRatingPriceLine(card({ priceUnit: 'unknown' }), units).price).toBe('Chưa có thông tin giá')
  })

  it('keeps the unit it was given and marks an estimate', () => {
    expect(placeCardRatingPriceLine(card({ priceUnit: 'per_hour' }), units).price).toBe('45k–90k/giờ')
    expect(placeCardRatingPriceLine(card({ priceUncertain: true }), units).price).toBe('~45k–90k/người')
  })
})
