import type { QueryClient } from '@tanstack/react-query'

import { queryKeys } from '../query-keys'

/**
 * Room events, named to match the SSE contract requested in GoGo-BE#154.
 * Declaring them before the stream exists is deliberate: the polling transport
 * below is transitional, and everything above this file is already written
 * against events rather than against a timer.
 */
export type RoomEventType =
  | 'room.status_changed'
  | 'participant.joined'
  | 'participant.left'
  | 'participant.selection_changed'
  | 'matching.started'
  | 'matching.completed'
  | 'matching.failed'
  | 'suggestions.generated'
  | 'suggestions.updated'
  | 'vote.changed'
  | 'plan.updated'

export interface RoomEvent {
  type: RoomEventType
  roomId: string
  /** Present on `plan.updated`; lets the plan-by-id cache refresh too. */
  planId?: string
}

/**
 * Which caches an event invalidates. This mapping is the whole reason the
 * realtime layer exists: when SSE lands, only the transport changes — screens,
 * hooks and this table stay put.
 */
export function applyRoomEvent(queryClient: QueryClient, event: RoomEvent): void {
  for (const queryKey of eventQueryKeys(event)) {
    void queryClient.invalidateQueries({ queryKey })
  }
}

/**
 * The caches one event touches, as keys. Pure, so a transport that replays
 * many events per tick can ask for all of them and invalidate each key once —
 * the polling transport used to call `applyRoomEvent` per event and refetch the
 * same room several times per tick.
 */
export function eventQueryKeys(event: RoomEvent): readonly (readonly unknown[])[] {
  const { roomId } = event

  switch (event.type) {
    case 'room.status_changed':
      return [queryKeys.room(roomId)]

    case 'participant.joined':
    case 'participant.left':
    case 'participant.selection_changed':
      // Member progress lives on both the room summary and the members list.
      return [queryKeys.room(roomId), queryKeys.roomMembers(roomId)]

    case 'matching.started':
    case 'matching.completed':
    case 'matching.failed':
      return [queryKeys.room(roomId), queryKeys.roomSuggestions(roomId)]

    case 'suggestions.generated':
    case 'suggestions.updated':
    case 'vote.changed':
      return [queryKeys.roomSuggestions(roomId)]

    case 'plan.updated':
      return event.planId
        ? [queryKeys.roomCurrentPlan(roomId), queryKeys.plan(event.planId)]
        : [queryKeys.roomCurrentPlan(roomId)]
  }
}

/** Every event a given room screen cares about, by the phase it is in. */
export const ROOM_PHASE_EVENTS: Record<RoomPhase, readonly RoomEventType[]> = {
  lobby: [
    'room.status_changed',
    'participant.joined',
    'participant.left',
    'participant.selection_changed',
  ],
  matching: [
    'room.status_changed',
    'matching.started',
    'matching.completed',
    'matching.failed',
    'suggestions.generated',
    'suggestions.updated',
    'vote.changed',
  ],
  plan: ['room.status_changed', 'plan.updated'],
}

/**
 * A screen declares which phase it is showing rather than a refresh interval —
 * cadence is the transport's business, not the screen's.
 */
export type RoomPhase = 'lobby' | 'matching' | 'plan'
