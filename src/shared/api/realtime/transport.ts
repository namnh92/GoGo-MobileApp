import type { QueryClient } from '@tanstack/react-query'

import { applyRoomEvent, ROOM_PHASE_EVENTS, type RoomEventType, type RoomPhase } from './room-events'

/**
 * How a room stays fresh. Today the only implementation polls; GoGo-BE#154 adds
 * an SSE stream, and swapping it in means writing a second transport here and
 * changing nothing above.
 */
export interface RoomRealtimeTransport {
  readonly kind: 'polling' | 'sse'
  /** Starts delivering events for one room; returns a teardown. */
  subscribe: (options: RoomSubscription) => () => void
}

export interface RoomSubscription {
  roomId: string
  phase: RoomPhase
  queryClient: QueryClient
  /**
   * Reports transport health so a screen can show a degraded state. Must be
   * called asynchronously — a subscriber sets React state from it, and
   * `subscribe` runs inside an effect.
   */
  onStatusChange?: (status: RoomRealtimeStatus) => void
}

export type RoomRealtimeStatus = 'connecting' | 'live' | 'polling' | 'offline'

/**
 * Poll cadence per phase. Matching is the only phase where someone is waiting
 * on another person in real time; the plan changes rarely once built.
 */
const POLL_INTERVAL_MS: Record<RoomPhase, number> = {
  lobby: 5_000,
  matching: 4_000,
  plan: 15_000,
}

/**
 * Transitional transport (GoGo-BE#154). Polling cannot tell *what* changed, so
 * it replays every event the phase cares about and lets the invalidation table
 * decide — the same code path a real event will take.
 */
export const pollingTransport: RoomRealtimeTransport = {
  kind: 'polling',

  // Polling has no connection to report — it is either running or torn down,
  // which the caller already knows. `onStatusChange` exists for SSE, whose
  // state genuinely changes underneath the subscriber.
  subscribe({ roomId, phase, queryClient }) {
    const events: readonly RoomEventType[] = ROOM_PHASE_EVENTS[phase]
    const timer = setInterval(() => {
      for (const type of events) {
        applyRoomEvent(queryClient, { type, roomId })
      }
    }, POLL_INTERVAL_MS[phase])

    return () => clearInterval(timer)
  },
}

/**
 * The transport the app uses. A single assignment point so enabling SSE is one
 * line here plus a feature flag, never a change in a screen.
 */
export const roomRealtimeTransport: RoomRealtimeTransport = pollingTransport
