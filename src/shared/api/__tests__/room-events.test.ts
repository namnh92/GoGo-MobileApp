import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { queryKeys } from '../query-keys'
import { applyRoomEvent, eventQueryKeys, ROOM_PHASE_EVENTS, type RoomEventType } from '../realtime/room-events'

const ROOM_ID = 'room-1'

function trackInvalidations() {
  const client = new QueryClient()
  const spy = vi.spyOn(client, 'invalidateQueries').mockImplementation(() => Promise.resolve())
  const keys = () => spy.mock.calls.map(call => JSON.stringify(call[0]?.queryKey))
  return { client, keys }
}

describe('applyRoomEvent', () => {
  it('refreshes both member views when someone joins', () => {
    const { client, keys } = trackInvalidations()

    applyRoomEvent(client, { type: 'participant.joined', roomId: ROOM_ID })

    expect(keys()).toEqual([
      JSON.stringify(queryKeys.room(ROOM_ID)),
      JSON.stringify(queryKeys.roomMembers(ROOM_ID)),
    ])
  })

  it('refreshes only the ranking when a vote changes', () => {
    const { client, keys } = trackInvalidations()

    applyRoomEvent(client, { type: 'vote.changed', roomId: ROOM_ID })

    expect(keys()).toEqual([JSON.stringify(queryKeys.roomSuggestions(ROOM_ID))])
  })

  it('refreshes the plan by id as well when the event names one', () => {
    const { client, keys } = trackInvalidations()

    applyRoomEvent(client, { type: 'plan.updated', roomId: ROOM_ID, planId: 'plan-9' })

    expect(keys()).toEqual([
      JSON.stringify(queryKeys.roomCurrentPlan(ROOM_ID)),
      JSON.stringify(queryKeys.plan('plan-9')),
    ])
  })

  it('skips the plan-by-id refresh when no plan is named', () => {
    const { client, keys } = trackInvalidations()

    applyRoomEvent(client, { type: 'plan.updated', roomId: ROOM_ID })

    expect(keys()).toEqual([JSON.stringify(queryKeys.roomCurrentPlan(ROOM_ID))])
  })

  it('treats a failed match as a state change, not a silent no-op', () => {
    const { client, keys } = trackInvalidations()

    applyRoomEvent(client, { type: 'matching.failed', roomId: ROOM_ID })

    expect(keys()).toContain(JSON.stringify(queryKeys.room(ROOM_ID)))
    expect(keys()).toContain(JSON.stringify(queryKeys.roomSuggestions(ROOM_ID)))
  })
})

describe('ROOM_PHASE_EVENTS', () => {
  it('handles every event a phase subscribes to', () => {
    // The polling transport replays a phase's events wholesale, so an event
    // listed here with no branch in applyRoomEvent would refresh nothing.
    const handled: RoomEventType[] = [
      'room.status_changed',
      'participant.joined',
      'participant.left',
      'participant.selection_changed',
      'matching.started',
      'matching.completed',
      'matching.failed',
      'suggestions.generated',
      'suggestions.updated',
      'vote.changed',
      'plan.updated',
    ]

    for (const events of Object.values(ROOM_PHASE_EVENTS)) {
      for (const event of events) expect(handled).toContain(event)
    }
  })

  it('lets the lobby see the run and the plan land, but not the tally (#198)', () => {
    // The lobby sends a member on once the host's run or plan exists; on DEV it
    // refreshed only the room and a member sat there while both landed. Polling
    // folds these keys into one invalidation of room(id) per tick, and every
    // query under it that a screen has enabled refetches: the lobby adds one
    // read — the run while matching, the plan while ready or active — and only
    // while it is on top.
    const keys = ROOM_PHASE_EVENTS.lobby
      .flatMap(type => eventQueryKeys({ type, roomId: ROOM_ID }))
      .map(key => JSON.stringify(key))

    expect(keys).toContain(JSON.stringify(queryKeys.room(ROOM_ID)))
    expect(keys).toContain(JSON.stringify(queryKeys.roomSuggestions(ROOM_ID)))
    expect(keys).toContain(JSON.stringify(queryKeys.roomCurrentPlan(ROOM_ID)))
    expect(ROOM_PHASE_EVENTS.lobby).not.toContain('vote.changed')
    expect(ROOM_PHASE_EVENTS.lobby).not.toContain('suggestions.updated')
  })

  /**
   * #285 — the date screen showed stop progress from the server and nothing
   * asked the server again. Two people walk a date with two phones and only one
   * of them taps "done"; the other stood still for over three minutes on a
   * device. The phase has to carry stop progress and the end of the date.
   */
  it('lets the date see stop progress and the room ending', () => {
    expect(ROOM_PHASE_EVENTS.date).toContain('plan.updated')
    expect(ROOM_PHASE_EVENTS.date).toContain('room.status_changed')

    const keys = ROOM_PHASE_EVENTS.date
      .flatMap(type => eventQueryKeys({ type, roomId: ROOM_ID, planId: 'plan-1' }))
      .map(key => JSON.stringify(key))

    expect(keys).toContain(JSON.stringify(queryKeys.plan('plan-1')))
    expect(keys).toContain(JSON.stringify(queryKeys.roomCurrentPlan(ROOM_ID)))
    expect(keys).toContain(JSON.stringify(queryKeys.room(ROOM_ID)))
    // The date shows no tally and no candidate list.
    expect(ROOM_PHASE_EVENTS.date).not.toContain('vote.changed')
    expect(ROOM_PHASE_EVENTS.date).not.toContain('suggestions.generated')
  })
})
