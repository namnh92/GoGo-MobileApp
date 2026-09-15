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
    // refreshed only the room and a member sat there while both landed. The
    // polling transport folds these keys into the room's (see
    // polling-transport.test.ts), so watching them costs no extra request.
    const keys = ROOM_PHASE_EVENTS.lobby
      .flatMap(type => eventQueryKeys({ type, roomId: ROOM_ID }))
      .map(key => JSON.stringify(key))

    expect(keys).toContain(JSON.stringify(queryKeys.room(ROOM_ID)))
    expect(keys).toContain(JSON.stringify(queryKeys.roomSuggestions(ROOM_ID)))
    expect(keys).toContain(JSON.stringify(queryKeys.roomCurrentPlan(ROOM_ID)))
    expect(ROOM_PHASE_EVENTS.lobby).not.toContain('vote.changed')
    expect(ROOM_PHASE_EVENTS.lobby).not.toContain('suggestions.updated')
  })
})
