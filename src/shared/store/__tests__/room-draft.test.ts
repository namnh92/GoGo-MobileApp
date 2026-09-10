import { beforeEach, describe, expect, it } from 'vitest'

import { missingDraftFields, toCreateRoomBody, useRoomStore } from '../roomStore'

function draft() {
  return useRoomStore.getState()
}

beforeEach(() => {
  useRoomStore.getState().resetDraft()
  useRoomStore.setState({ audience: 'couple', participantCount: 4, budgetMode: 'per_person' })
})

describe('toCreateRoomBody', () => {
  it('forces a couple room to two people and mutual match', () => {
    useRoomStore.setState({ audience: 'couple', participantCount: 7 })
    useRoomStore.getState().patchDraft({ budgetAmount: 500_000 })

    const body = toCreateRoomBody(draft())

    expect(body.type).toBe('couple')
    expect(body.decisionMode).toBe('match')
    expect(body.participantCount).toBe(2)
  })

  it('keeps the chosen headcount and vote mode for a group room', () => {
    useRoomStore.setState({ audience: 'group-host', participantCount: 5 })
    useRoomStore.getState().patchDraft({ budgetAmount: 300_000 })

    const body = toCreateRoomBody(draft())

    expect(body.type).toBe('group')
    expect(body.decisionMode).toBe('vote')
    expect(body.participantCount).toBe(5)
  })

  it('sends the budget in integer minor units with the mode the host chose', () => {
    useRoomStore.setState({ audience: 'group-host', budgetMode: 'total' })
    useRoomStore.getState().patchDraft({ budgetAmount: 1_500_000, currency: 'VND' })

    const body = toCreateRoomBody(draft())

    expect(body.constraint.budgetMode).toBe('total')
    expect(body.constraint.budgetAmount).toBe(1_500_000)
    expect(body.constraint.currency).toBe('VND')
  })

  /**
   * APP-037 (#189) — the couple budget step asks for a total for two and the
   * store defaulted to per_person, so the amount was stored in the wrong unit
   * and the backend read it as a per-head ceiling: twice the intent.
   */
  it('sends a couple budget as a total whatever the store holds', () => {
    useRoomStore.setState({ audience: 'couple', budgetMode: 'per_person' })
    useRoomStore.getState().patchDraft({ budgetAmount: 500_000, currency: 'VND' })

    const body = toCreateRoomBody(draft())

    expect(body.type).toBe('couple')
    expect(body.constraint.budgetMode).toBe('total')
    expect(body.constraint.budgetAmount).toBe(500_000)
  })

  it('leaves a group host with either unit', () => {
    for (const mode of ['per_person', 'total'] as const) {
      useRoomStore.setState({ audience: 'group-host', budgetMode: mode })
      useRoomStore.getState().patchDraft({ budgetAmount: 250_000 })
      expect(toCreateRoomBody(draft()).constraint.budgetMode).toBe(mode)
    }
  })

  it('omits optional constraint fields rather than sending nulls', () => {
    useRoomStore.getState().patchDraft({ budgetAmount: 300_000 })

    const constraint = toCreateRoomBody(draft()).constraint

    expect(constraint).not.toHaveProperty('areaKey')
    expect(constraint).not.toHaveProperty('radiusM')
    expect(constraint).not.toHaveProperty('startAt')
    expect(constraint).not.toHaveProperty('originLat')
  })

  it('includes an origin only when both coordinates are known', () => {
    useRoomStore.getState().patchDraft({ budgetAmount: 300_000, originLat: 10.77, originLng: null })
    expect(toCreateRoomBody(draft()).constraint).not.toHaveProperty('originLat')

    useRoomStore.getState().patchDraft({ originLng: 106.7 })
    expect(toCreateRoomBody(draft()).constraint).toMatchObject({ originLat: 10.77, originLng: 106.7 })
  })

  it('sends seed places as ids, not names', () => {
    useRoomStore.getState().patchDraft({ budgetAmount: 300_000 })
    useRoomStore.getState().addSeedPlace({ placeId: 'place-a', name: 'Cà phê Đỗ Phủ' })
    useRoomStore.getState().addSeedPlace({ placeId: 'place-b', name: 'Landmark 81' })

    expect(toCreateRoomBody(draft()).seedPlaceIds).toEqual(['place-a', 'place-b'])
  })

  it('refuses a duplicate seed place', () => {
    useRoomStore.getState().addSeedPlace({ placeId: 'place-a', name: 'Cà phê Đỗ Phủ' })
    useRoomStore.getState().addSeedPlace({ placeId: 'place-a', name: 'Cà phê Đỗ Phủ' })

    expect(draft().seedPlaces).toHaveLength(1)
  })

  it('stops at the ten seed places the contract allows', () => {
    for (let index = 0; index < 14; index += 1) {
      useRoomStore.getState().addSeedPlace({ placeId: `place-${index}`, name: `Place ${index}` })
    }

    // Capped on the way in, so the user sees the limit instead of losing
    // places silently at create time.
    expect(draft().seedPlaces).toHaveLength(10)
  })
})

describe('missingDraftFields', () => {
  it('reports the steps the wizard has not filled in', () => {
    expect(missingDraftFields(draft())).toEqual(['budget', 'area'])
  })

  it('accepts an origin in place of an area key', () => {
    useRoomStore.getState().patchDraft({ budgetAmount: 300_000, originLat: 10.77, originLng: 106.7 })
    expect(missingDraftFields(draft())).toEqual([])
  })
})

describe('resetDraft', () => {
  it('clears the draft once the room exists', () => {
    useRoomStore.getState().patchDraft({ budgetAmount: 300_000, areaKey: 'hcm_q1', moodKeys: ['chill'] })
    useRoomStore.getState().resetDraft()

    expect(draft().budgetAmount).toBeNull()
    expect(draft().areaKey).toBeNull()
    expect(draft().moodKeys).toEqual([])
  })
})
