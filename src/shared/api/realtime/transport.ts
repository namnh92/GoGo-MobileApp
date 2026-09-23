import type { QueryClient } from '@tanstack/react-query'

import { appActivity, type AppActivity } from './app-activity'
import { eventQueryKeys, ROOM_PHASE_EVENTS, type RoomPhase } from './room-events'

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
   * The plan this screen is keyed by, where it has one.
   *
   * `plan.updated` refreshes `roomCurrentPlan(roomId)` on its own, but a screen
   * routed by plan id reads `plan(planId)` — a different key. A transport that
   * synthesises events (the poller) has no way to know that id, so the screen
   * hands it over. Without it the date screen subscribed and still never
   * refetched the plan it was showing (#285).
   */
  planId?: string
  /**
   * Reports transport health so a screen can show a degraded state. Must be
   * called asynchronously — a subscriber sets React state from it, and
   * `subscribe` runs inside an effect.
   */
  onStatusChange?: (status: RoomRealtimeStatus) => void
}

export type RoomRealtimeStatus = 'connecting' | 'live' | 'polling' | 'offline'

/**
 * Poll cadence per phase.
 *
 * Matching and the date itself are the phases where someone is waiting on
 * another person in real time: one taps "done" at a stop and the other's phone
 * has to move with it. The plan changes rarely once built.
 */
export const POLL_INTERVAL_MS: Record<RoomPhase, number> = {
  lobby: 5_000,
  matching: 4_000,
  plan: 15_000,
  date: 5_000,
}

/**
 * How far a quiet room backs off. Each tick that changes nothing doubles the
 * wait, up to this multiple of the phase cadence; the first change resets it.
 * A room where nobody has acted for a minute is asked four times less often
 * than one mid-vote, and the person mid-vote still sees the base cadence.
 */
export const IDLE_BACKOFF_MAX_MULTIPLIER = 4

/**
 * One poller per room, however many screens are looking at it.
 *
 * This replaces a timer per subscriber. A navigation stack keeps the screens
 * behind the current one mounted, so lobby → waiting → swipe → result was four
 * timers on one room, each replaying every event of its phase, each event
 * invalidating the same keys — measured on DEV at 225 requests a minute from
 * one phone, which at two Redis commands a request was most of the free tier.
 */
interface RoomPoller {
  roomId: string
  queryClient: QueryClient
  /** Subscriber count per phase; cadence follows the fastest phase present. */
  phases: Map<RoomPhase, number>
  /** Plan ids the subscribed screens are keyed by, with their subscriber count. */
  planIds: Map<string, number>
  timer: ReturnType<typeof setTimeout> | null
  idleTicks: number
  inFlight: boolean
  unsubscribeActivity: () => void
}

const pollers = new Map<string, RoomPoller>()

export function createPollingTransport(activity: AppActivity = appActivity): RoomRealtimeTransport {
  const baseInterval = (poller: RoomPoller): number =>
    Math.min(...[...poller.phases.keys()].map(phase => POLL_INTERVAL_MS[phase]))

  /**
   * Every key any subscribed phase cares about, once each, with descendants
   * dropped when their ancestor is present: keys are hierarchical, so
   * invalidating `room(id)` already refetches `roomMembers(id)`. Sending both
   * refetched the members twice.
   */
  const keysToInvalidate = (poller: RoomPoller): (readonly unknown[])[] => {
    const seen = new Map<string, readonly unknown[]>()
    // No plan id still asks for the room's current plan; each id a screen gave
    // us adds the plan that screen is actually showing.
    const planIds: (string | undefined)[] = poller.planIds.size > 0 ? [...poller.planIds.keys()] : [undefined]
    for (const phase of poller.phases.keys()) {
      for (const type of ROOM_PHASE_EVENTS[phase]) {
        for (const planId of planIds) {
          for (const key of eventQueryKeys({ type, roomId: poller.roomId, ...(planId ? { planId } : {}) })) {
            seen.set(JSON.stringify(key), key)
          }
        }
      }
    }
    const keys = [...seen.values()]
    return keys.filter(key => !keys.some(other => other !== key && isPrefixOf(other, key)))
  }

  const schedule = (poller: RoomPoller, delayMs: number) => {
    if (poller.timer) clearTimeout(poller.timer)
    poller.timer = setTimeout(() => void tick(poller), delayMs)
  }

  const tick = async (poller: RoomPoller) => {
    poller.timer = null
    // A tick that overruns its interval must not stack behind itself. The
    // next one is scheduled from the end of this one, never from a timer that
    // fires regardless.
    if (poller.inFlight || !activity.isActive() || !pollers.has(poller.roomId)) return
    poller.inFlight = true

    const keys = keysToInvalidate(poller)
    const before = keys.map(key => poller.queryClient.getQueryData(key))
    try {
      await Promise.all(keys.map(queryKey => poller.queryClient.invalidateQueries({ queryKey })))
    } catch {
      // A failed refetch is the query's business and is reported through it;
      // the poller's job is only to try again.
    }
    // Structural sharing keeps the reference when nothing changed, so a
    // reference comparison is a change detector that costs nothing.
    const changed = keys.some((key, i) => poller.queryClient.getQueryData(key) !== before[i])
    poller.idleTicks = changed ? 0 : poller.idleTicks + 1
    poller.inFlight = false

    if (!pollers.has(poller.roomId)) return
    const multiplier = Math.min(2 ** poller.idleTicks, IDLE_BACKOFF_MAX_MULTIPLIER)
    schedule(poller, baseInterval(poller) * multiplier)
  }

  return {
    kind: 'polling',

    subscribe({ roomId, phase, queryClient, planId }) {
      let poller = pollers.get(roomId)
      if (!poller) {
        const created: RoomPoller = {
          roomId,
          queryClient,
          phases: new Map(),
          planIds: new Map(),
          timer: null,
          idleTicks: 0,
          inFlight: false,
          unsubscribeActivity: () => undefined,
        }
        // Backgrounded, the phone stops asking. Foregrounded, it asks at once
        // rather than waiting out whatever was left of the interval — the
        // person just looked at the screen.
        created.unsubscribeActivity = activity.subscribe(active => {
          if (!pollers.has(roomId)) return
          if (active) {
            created.idleTicks = 0
            schedule(created, 0)
          } else if (created.timer) {
            clearTimeout(created.timer)
            created.timer = null
          }
        })
        poller = created
        pollers.set(roomId, poller)
      }

      poller.phases.set(phase, (poller.phases.get(phase) ?? 0) + 1)
      if (planId) poller.planIds.set(planId, (poller.planIds.get(planId) ?? 0) + 1)
      // A new subscriber resets the backoff: a screen just opened wants fresh
      // data on the base cadence, whatever the room was doing before.
      poller.idleTicks = 0
      if (activity.isActive()) schedule(poller, baseInterval(poller))

      return () => {
        const current = pollers.get(roomId)
        if (!current) return
        const remaining = (current.phases.get(phase) ?? 1) - 1
        if (remaining > 0) current.phases.set(phase, remaining)
        else current.phases.delete(phase)

        if (planId) {
          const plansLeft = (current.planIds.get(planId) ?? 1) - 1
          if (plansLeft > 0) current.planIds.set(planId, plansLeft)
          else current.planIds.delete(planId)
        }

        if (current.phases.size > 0) {
          if (activity.isActive() && !current.inFlight) schedule(current, baseInterval(current))
          return
        }
        if (current.timer) clearTimeout(current.timer)
        current.timer = null
        current.unsubscribeActivity()
        pollers.delete(roomId)
      }
    },
  }
}

const isPrefixOf = (prefix: readonly unknown[], key: readonly unknown[]): boolean =>
  prefix.length < key.length && prefix.every((part, i) => part === key[i])

/** Transitional transport (GoGo-BE#154). Polls; see `createPollingTransport`. */
export const pollingTransport: RoomRealtimeTransport = createPollingTransport()

/**
 * The transport the app uses. A single assignment point so enabling SSE is one
 * line here plus a feature flag, never a change in a screen.
 */
export const roomRealtimeTransport: RoomRealtimeTransport = pollingTransport

/** Test seam: forget every room poller. */
export function resetPollingTransportForTests(): void {
  for (const poller of pollers.values()) {
    if (poller.timer) clearTimeout(poller.timer)
    poller.unsubscribeActivity()
  }
  pollers.clear()
}
