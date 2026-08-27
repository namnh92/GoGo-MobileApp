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

  it('sends the budget in integer minor units with its mode', () => {
    useRoomStore.setState({ budgetMode: 'total' })
    useRoomStore.getState().patchDraft({ budgetAmount: 1_500_000, currency: 'VND' })

    const body = toCreateRoomBody(draft())

    expect(body.constraint.budgetMode).toBe('total')
    expect(body.constraint.budgetAmount).toBe(1_500_000)
    expect(body.constraint.currency).toBe('VND')
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

  it('caps seed places at the ten the contract allows', () => {
    const ids = Array.from({ length: 14 }, (_, index) => `place-${index}`)
    useRoomStore.getState().patchDraft({ budgetAmount: 300_000, seedPlaceIds: ids })

    expect(toCreateRoomBody(draft()).seedPlaceIds).toHaveLength(10)
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
