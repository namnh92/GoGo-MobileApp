import { describe, expect, it } from 'vitest'

import type { PlaceSearchResult, Plan, RoomSummary } from '../types'
import {
  formatDistance,
  formatMinuteOfDay,
  memberProgress,
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
    expect(summary.stops[0].isLocked).toBe(true)
    // Over-budget comes from the upper bound; never soften it in the adapter.
    expect(summary.overBudget).toBe(true)
  })

  it('defaults a plan with no totals to a safe, non-committal summary', () => {
    const summary = toPlanSummary({ id: 'p1', roomId: 'r1' } as Plan)

    expect(summary.stops).toEqual([])
    expect(summary.overBudget).toBe(false)
    expect(summary.currency).toBe('VND')
  })
})
