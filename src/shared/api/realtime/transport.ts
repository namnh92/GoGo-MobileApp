import type { QueryClient } from '@tanstack/react-query'

import { currentAccessGrant } from '../client'
import { EXPIRY_SKEW_MS, getSession, subscribeToSession, type Session } from '../session'
import { env } from '@/shared/config/env'

import { appActivity, type AppActivity } from './app-activity'
import { eventQueryKeys, ROOM_PHASE_EVENTS, type RoomEventType, type RoomPhase } from './room-events'
import { xhrSseConnector, type SseConnection, type SseConnector } from './sse-connection'

/**
 * How a room stays fresh. Two implementations: the SSE stream the app uses
 * (GoGo-BE#154, `createSseTransport`) and the poller it falls back to
 * (`createPollingTransport`). Screens name a phase and never a cadence, so
 * which one is in play changes nothing above this file.
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
 * Cadence of the poll that keeps running underneath a live stream.
 *
 * A stream that is open is not the same as a stream that carries everything.
 * Measured against DEV `a9da62d` on 2026-09-22: finalising a room emits no
 * event at all (GoGo-BE#608) — a member watching the result screen saw only a
 * heartbeat for thirty seconds. Dropping the poll the moment SSE connects
 * would have turned a twelve-second wait into no update at all.
 *
 * So `matching` keeps its normal cadence: that is where the missing event
 * lives, and it is the one phase where someone is waiting on another person.
 * The other phases slow down, because every event they need does arrive.
 * When GoGo-BE#608 lands, `matching` here becomes as slow as the rest.
 */
export const SAFETY_POLL_INTERVAL_MS: Record<RoomPhase, number> = {
  lobby: 20_000,
  matching: 4_000,
  plan: 30_000,
  // Completing a stop does emit `plan.updated` — measured against DEV
  // `a9da62d`, the event arrived about 1.5 s after the write — so the date does
  // not need `matching`'s full cadence underneath a live stream. It keeps a
  // slower net because two people are walking it together and a silent gap
  // there is the #285 defect all over again.
  date: 20_000,
}

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

/**
 * Every registry handed out, so the test reset can reach them all.
 *
 * The map used to be one module-level registry shared by every transport this
 * factory made — and there are two: the full-cadence fallback and the slow
 * safety poll. One room subscribed to both in turn (the stream swaps modes)
 * collided on the same key: the newer entry evicted the older, and the older's
 * tick still found *a* poller under that room id, passed its guard and
 * rescheduled itself with no phases left — `Math.min()` of nothing is Infinity —
 * leaving a timer and a poller alive with nothing to poll for.
 */
const registries: Map<string, RoomPoller>[] = []

export function createPollingTransport(
  activity: AppActivity = appActivity,
  intervals: Record<RoomPhase, number> = POLL_INTERVAL_MS,
): RoomRealtimeTransport {
  const pollers = new Map<string, RoomPoller>()
  registries.push(pollers)

  /** This tick still belongs to the poller registered for its room. */
  const current = (poller: RoomPoller): boolean => pollers.get(poller.roomId) === poller

  const baseInterval = (poller: RoomPoller): number =>
    Math.min(...[...poller.phases.keys()].map(phase => intervals[phase]))

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
    if (poller.inFlight || !activity.isActive() || !current(poller)) return
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

    if (!current(poller)) return
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
          if (pollers.get(roomId) !== created) return
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

/** The fallback, and what every SSE stream degrades to. See `createPollingTransport`. */
export const pollingTransport: RoomRealtimeTransport = createPollingTransport()

/** The slow poll that keeps running underneath a live stream. */
export const safetyPollingTransport: RoomRealtimeTransport = createPollingTransport(
  appActivity,
  SAFETY_POLL_INTERVAL_MS,
)

/** Test seam: forget every room poller, in every registry this factory made. */
export function resetPollingTransportForTests(): void {
  for (const registry of registries) {
    for (const poller of registry.values()) {
      if (poller.timer) clearTimeout(poller.timer)
      poller.unsubscribeActivity()
    }
    registry.clear()
  }
}

// ---------------------------------------------------------------------------
// SSE — the transport the app uses (GoGo-MobileApp#286)
// ---------------------------------------------------------------------------

/**
 * How long to wait before the first reconnect, and the ceiling it doubles to.
 *
 * `rooms.events` is rate limited at 30 a minute per actor, so a reconnect loop
 * tighter than two seconds would spend the room's whole budget locking itself
 * out. The first wait is therefore the limit's own period, not the usual
 * sub-second retry.
 */
export const SSE_RECONNECT_BASE_MS = 2_000
export const SSE_RECONNECT_MAX_MS = 30_000

/**
 * Reconnect this long before the access token expires. A stream authorised once
 * keeps running with a token the rest of the app has already rotated; replacing
 * the connection early is cheaper than discovering it went stale.
 *
 * It has to sit **inside** the session's own renewal window. At 60 s it did not:
 * `isAccessTokenExpired` only renews within `EXPIRY_SKEW_MS`, so the reconnect
 * asked for a token, got the same one back, computed a lifetime that clamped to
 * the floor, and came round again — about thirty reconnects in the last minute
 * of every token, against a limit of thirty a minute per actor. Derived from the
 * skew so the two cannot drift apart again.
 */
export const SSE_TOKEN_MARGIN_MS = EXPIRY_SKEW_MS - 5_000

/**
 * How long a stream outlives its last subscriber.
 *
 * Navigating between two screens of the same room unmounts one before the next
 * mounts, so the subscriber count touches zero in between. Tearing the
 * connection down there and opening another cost a reconnect and a full replay
 * on every hop — observed on a device walking lobby → plan → active date.
 * A poller could be dropped and recreated for free; a stream cannot.
 */
export const SSE_IDLE_GRACE_MS = 5_000

/**
 * How long a connection has to hold before its failures start counting from
 * zero again.
 *
 * Opening is not stability. A stream that opened and dropped seconds later used
 * to clear the attempt counter on the way up, so an open/drop loop reconnected
 * every two seconds forever — and two rooms doing it together spend the actor's
 * whole per-minute budget. Derived from the ceiling: a connection that does not
 * outlive the longest wait it would otherwise take has not earned a shorter one.
 */
export const SSE_STABLE_AFTER_MS = SSE_RECONNECT_MAX_MS

/**
 * The server's answer when this actor has too many streams open, or has opened
 * them too often.
 *
 * The client deliberately does not model the ceiling. Its value lives on the
 * server, other clients of the same account consume the same allowance, and a
 * number copied here would be a guess that goes stale silently. So the rule is
 * to stop asking when told to, poll meanwhile, and try again later — with the
 * wait the server named, or a full limit period when it named none.
 */
const SSE_RATE_LIMITED_STATUS = 429
export const SSE_RATE_LIMIT_COOLDOWN_MS = 60_000

/**
 * Statuses that mean SSE is not coming back on its own, per room: the actor is
 * not a member (403), the room is gone (404), or the route does not exist on
 * this backend (501). A 503 is the environment's kill switch
 * (`REALTIME_SSE_ENABLED=false`) and takes the whole process down to polling —
 * retrying it on every room would be pure noise.
 *
 * A 401 is deliberately absent: the next attempt asks `auth()` again, which
 * renews an expired token through the client's single-flight refresh. Giving up
 * on it would drop a room to polling for the rest of the session over a token
 * that was about to be replaced anyway.
 */
const ROOM_FATAL_STATUSES = new Set([403, 404, 501])
const ENVIRONMENT_OFF_STATUS = 503

export interface SseTransportOptions {
  /** Opens one stream. Injected so tests never touch `XMLHttpRequest`. */
  connect?: SseConnector
  /** Where freshness comes from whenever the stream is not live. */
  fallback?: RoomRealtimeTransport
  /**
   * The slower poll that keeps running while the stream *is* live, so a gap in
   * what the backend emits cannot leave a screen frozen. See
   * `SAFETY_POLL_INTERVAL_MS`.
   */
  safety?: RoomRealtimeTransport
  activity?: AppActivity
  /**
   * A bearer good for a stream, and when it stops being one. `force` renews
   * even when the token still looks fresh — the only way past a server that has
   * just refused the one we hold.
   */
  auth?: (options?: { force?: boolean }) => Promise<{ token: string; expiresAt: number } | null>
  /** Base URL including `/v1`; defaults to the app's configured API. */
  apiUrl?: string
  /** Client kill switch. `false` never opens a stream and polls instead. */
  enabled?: boolean
  /** Session changes. Injected so a test can drive a logout without a keychain. */
  onSession?: (listener: (session: Session | null) => void) => () => void
  /** The session in hand when the transport is created. */
  initialSession?: () => Session | null
  now?: () => number
  /** Reconnect jitter. Injected so a test's waits are the backoff itself. */
  random?: () => number
}

interface SseStream {
  roomId: string
  queryClient: QueryClient
  /** Subscriber count per phase, exactly as the poller counts them. */
  phases: Map<RoomPhase, number>
  /**
   * Plan ids the subscribed screens are keyed by, with their subscriber count.
   *
   * A screen routed by plan id reads `plan(planId)`, which no room id names
   * (#285). The stream has to hand that id to both polls underneath it and use
   * it when the server tells us to resync — otherwise adopting SSE quietly
   * takes the date screen back to never refreshing.
   */
  planIds: Map<string, number>
  listeners: Set<(status: RoomRealtimeStatus) => void>
  connection: SseConnection | null
  /**
   * The attempt that owns the in-flight open, or null.
   *
   * A boolean was not enough: background during a pending `auth()` and
   * foreground before it resolves, and the stale attempt cleared the flag the
   * live one had just set — letting a third attempt start and leaving one of
   * the two sockets unreachable.
   */
  opening: number | null
  lastEventId: string | null
  attempt: number
  retryTimer: ReturnType<typeof setTimeout> | null
  tokenTimer: ReturnType<typeof setTimeout> | null
  /** Running while a live connection has yet to prove it will hold. */
  stableTimer: ReturnType<typeof setTimeout> | null
  /** Set while the stream is outliving its last subscriber. */
  graceTimer: ReturnType<typeof setTimeout> | null
  /** One poll subscription per distinct phase, at whichever cadence `pollMode` names. */
  polls: Map<RoomPhase, () => void>
  /** `down` is the full-cadence fallback; `live` is the slow safety poll. */
  pollMode: 'down' | 'live'
  status: RoomRealtimeStatus
  /** This room will not get a stream again; poll and stop trying. */
  givenUp: boolean
  /** The last attempt was refused, so the next one must not reuse that token. */
  renewFirst: boolean
  /** A room event arrived while no screen was subscribed; the next one refetches. */
  missedWhileIdle: boolean
  unsubscribeActivity: () => void
  /** Guards callbacks from a connection that has already been replaced. */
  generation: number
}

const streams = new Map<string, SseStream>()

/** Set by a 503: the backend says realtime is off here, for every room. */
let environmentRealtimeOff = false

/** Identifies the actor a stream was authorised for; a token refresh keeps it. */
const actorOf = (session: Session | null): string =>
  session ? `${session.kind}:${session.userId ?? ''}:${session.guestSessionId ?? ''}` : ''

/**
 * Invalidate hierarchical keys without asking for the same data twice.
 *
 * Invalidation is not exact, so `rooms/<id>` already refetches
 * `rooms/<id>/plan/current`. Sending both cancels the refetch the first one
 * started and begins it again — the screen sees a loading state it did not need
 * and the request count doubles. Every path that invalidates a *set* of keys
 * goes through here; a single key needs nothing.
 */
const invalidateDeduped = (queryClient: QueryClient, keys: readonly (readonly unknown[])[]) => {
  const unique = [...new Map(keys.map(key => [JSON.stringify(key), key])).values()]
  for (const queryKey of unique.filter(key => !unique.some(other => other !== key && isPrefixOf(other, key)))) {
    void queryClient.invalidateQueries({ queryKey })
  }
}

let openSeq = 0

export function createSseTransport(options: SseTransportOptions = {}): RoomRealtimeTransport {
  const connect = options.connect ?? xhrSseConnector
  const fallback = options.fallback ?? pollingTransport
  const safety = options.safety ?? safetyPollingTransport
  const activity = options.activity ?? appActivity
  const auth = options.auth ?? currentAccessGrant
  const apiUrl = options.apiUrl ?? env.apiUrl
  const enabled = options.enabled ?? true
  const now = options.now ?? Date.now
  const random = options.random ?? Math.random
  const watchSession = options.onSession ?? subscribeToSession
  const readSession = options.initialSession ?? getSession

  /**
   * Status reaches subscribers asynchronously. `subscribe` runs inside a React
   * effect and a subscriber sets state from this, so calling it synchronously
   * would set state during render.
   */
  const setStatus = (stream: SseStream, status: RoomRealtimeStatus) => {
    if (stream.status === status) return
    stream.status = status
    const listeners = [...stream.listeners]
    setTimeout(() => {
      for (const listener of listeners) listener(status)
    }, 0)
  }

  /**
   * Keeps exactly one poll subscription per subscribed phase, at the cadence
   * the given mode asks for. Called whenever the mode changes or a phase
   * appears, so a screen opened mid-stream is covered too.
   */
  const poll = (stream: SseStream, mode: 'down' | 'live') => {
    if (mode !== stream.pollMode) {
      for (const teardown of stream.polls.values()) teardown()
      stream.polls.clear()
      stream.pollMode = mode
    }
    const transport = mode === 'live' ? safety : fallback
    for (const phase of stream.phases.keys()) {
      if (stream.polls.has(phase)) continue
      // One poll subscription per phase, per plan id a screen named. A screen
      // with no plan id still gets the room's keys.
      const planIds = stream.planIds.size > 0 ? [...stream.planIds.keys()] : [undefined]
      const teardowns = planIds.map(planId =>
        transport.subscribe({
          roomId: stream.roomId,
          phase,
          queryClient: stream.queryClient,
          ...(planId ? { planId } : {}),
        }),
      )
      stream.polls.set(phase, () => {
        for (const teardown of teardowns) teardown()
      })
    }
  }

  const startFallback = (stream: SseStream) => {
    poll(stream, 'down')
    setStatus(stream, 'polling')
  }

  const stopPolls = (stream: SseStream) => {
    for (const teardown of stream.polls.values()) teardown()
    stream.polls.clear()
  }

  const clearTimers = (stream: SseStream) => {
    if (stream.retryTimer) clearTimeout(stream.retryTimer)
    if (stream.tokenTimer) clearTimeout(stream.tokenTimer)
    if (stream.stableTimer) clearTimeout(stream.stableTimer)
    if (stream.graceTimer) clearTimeout(stream.graceTimer)
    stream.retryTimer = null
    stream.tokenTimer = null
    stream.stableTimer = null
    stream.graceTimer = null
  }

  /**
   * Ends a stream for good: timers, socket, polls, the activity listener and
   * the map entry. Every path that abandons a stream goes through here, so none
   * of them can leave a subscriber-free stream behind with its cleanup half
   * done.
   */
  const dispose = (stream: SseStream) => {
    clearTimers(stream)
    closeConnection(stream)
    stopPolls(stream)
    stream.unsubscribeActivity()
    streams.delete(stream.roomId)
  }

  /**
   * A stream is authorised for one actor. Signing out, or signing in as someone
   * else, must not leave a socket open on the previous person's rooms — the
   * bearer is already attached to the request, so it keeps delivering their
   * room events until the token rotates, and a new subscriber keyed only by
   * room id would inherit it. The purge rule in the Mobile guide says the same
   * thing about room data on logout.
   */
  let actor: string | null = null
  /**
   * Read when the first stream appears, not when this module loads: nothing is
   * authorised yet at import time, and reaching for the session there makes the
   * transport a side effect of being imported.
   */
  const baselineActor = () => {
    if (actor === null) actor = actorOf(readSession())
  }
  watchSession(session => {
    if (actor === null) return
    const next = actorOf(session)
    // A token refresh keeps the actor; only a real change matters.
    if (next === actor) return
    // Arriving at an actor from none is hydration, not a switch: on a cold deep
    // link the baseline can be taken before the Keychain has been read, and
    // tearing the stream down there killed it for good — the subscribing effect
    // has no session dependency, so nothing would resubscribe.
    if (actor === '') {
      actor = next
      return
    }
    actor = next
    for (const stream of [...streams.values()]) {
      // Nobody is watching this one; it goes.
      if (stream.phases.size === 0) {
        dispose(stream)
        continue
      }
      /**
       * The screens are still open — a guest claiming their account keeps
       * looking at the same room. Deleting the stream would end its updates for
       * good, because the subscribing effect has no session dependency and
       * would never ask again. So the credential is replaced, not the screens:
       * the old socket closes, the resume point goes with the old actor, and
       * the room polls until the new one is connected.
       */
      closeConnection(stream)
      stream.lastEventId = null
      stream.givenUp = false
      stream.renewFirst = true
      startFallback(stream)
      void open(stream)
    }
  })

  const closeConnection = (stream: SseStream) => {
    stream.generation += 1
    stream.connection?.close()
    stream.connection = null
    stream.opening = null
  }

  /**
   * Refetch everything the subscribed screens are showing.
   *
   * Used wherever the stream cannot vouch for continuity: a `resync`, an event
   * that arrived with nobody watching, or a connection opened with no resume
   * point at all.
   */
  const refetchSubscribed = (stream: SseStream) => {
    const planIds = stream.planIds.size > 0 ? [...stream.planIds.keys()] : [undefined]
    const keys: (readonly unknown[])[] = []
    for (const phase of stream.phases.keys()) {
      for (const type of ROOM_PHASE_EVENTS[phase]) {
        for (const planId of planIds) {
          keys.push(
            ...eventQueryKeys({
              type,
              roomId: stream.roomId,
              ...(planId ? { planId } : {}),
            }),
          )
        }
      }
    }
    invalidateDeduped(stream.queryClient, keys)
  }

  /** Does any subscribed phase care about this event type? */
  const interested = (stream: SseStream, type: string): type is RoomEventType => {
    for (const phase of stream.phases.keys()) {
      if ((ROOM_PHASE_EVENTS[phase] as readonly string[]).includes(type)) return true
    }
    return false
  }

  const planIdOf = (data: string): string | undefined => {
    try {
      const parsed: unknown = JSON.parse(data)
      const payload = (parsed as { payload?: { planId?: unknown } } | null)?.payload
      return typeof payload?.planId === 'string' ? payload.planId : undefined
    } catch {
      // A payload we cannot read still tells us the room moved; the event type
      // alone decides what to invalidate.
      return undefined
    }
  }

  /**
   * `minWaitMs` is a floor a caller knows about that the backoff does not — the
   * wait a rate-limited server asked for. It raises the wait, never lowers it.
   */
  const scheduleRetry = (stream: SseStream, minWaitMs = 0) => {
    if (stream.givenUp || stream.retryTimer) return
    const backoff = Math.min(SSE_RECONNECT_BASE_MS * 2 ** stream.attempt, SSE_RECONNECT_MAX_MS)
    // Jitter so two rooms dropped by the same network blip do not come back on
    // the same second and spend the actor's budget together. Added, never
    // subtracted: the base is the rate limit's own period and is a floor.
    const wait = Math.max(backoff, minWaitMs) + random() * SSE_RECONNECT_BASE_MS
    stream.attempt += 1
    stream.retryTimer = setTimeout(() => {
      stream.retryTimer = null
      void open(stream)
    }, wait)
  }

  /** Stop streaming this room for good; polling carries it from here. */
  const giveUp = (stream: SseStream) => {
    stream.givenUp = true
    // Nothing is watching and the hand-off timer is about to be cancelled with
    // it: let go now rather than keep a dead stream and its activity listener.
    if (stream.phases.size === 0) {
      dispose(stream)
      return
    }
    clearTimers(stream)
    closeConnection(stream)
    startFallback(stream)
  }

  const open = async (stream: SseStream) => {
    if (!streams.has(stream.roomId) || stream.givenUp) return
    if (!enabled || environmentRealtimeOff) {
      startFallback(stream)
      return
    }
    if (!activity.isActive()) return
    // A reconnect is already scheduled. Another screen opening the same room is
    // not a reason to skip the wait — that is how a rate-limited room gets hit
    // again on every navigation.
    if (stream.retryTimer) return
    // A stream is for the screens watching it. During the hand-off window the
    // existing connection is deliberately kept, but nothing here may open a new
    // one for a room nobody is looking at.
    if (stream.phases.size === 0) return
    // Two screens subscribing in the same tick both reach here before either
    // `auth()` has answered, which used to open the room twice.
    if (stream.connection || stream.opening !== null) return
    const attempt = (openSeq += 1)
    stream.opening = attempt

    // Only the first attempt reads as "connecting"; a reconnect behind a live
    // poll is still polling as far as a screen is concerned.
    if (stream.polls.size === 0) setStatus(stream, 'connecting')

    // Captured before the await, not after. Backgrounding invalidates the
    // attempt in flight by moving the generation on; reading it afterwards
    // picked up that new value and opened a connection for an app that had
    // already gone away.
    const attemptGeneration = stream.generation
    const grant = await auth({ force: stream.renewFirst }).catch(() => null)
    // Only the attempt that set the flag may clear it.
    if (stream.opening === attempt) stream.opening = null
    // Whatever happened while we waited decides this, not the fact that a token
    // arrived: the stream may have been disposed, given up, superseded by a
    // newer attempt, lost its last screen, or the app may have backgrounded.
    const stillWanted =
      streams.get(stream.roomId) === stream &&
      !stream.givenUp &&
      // The environment switch may have been thrown by another room while this
      // attempt was waiting for its token.
      !environmentRealtimeOff &&
      stream.generation === attemptGeneration &&
      stream.phases.size > 0 &&
      activity.isActive()
    if (!stillWanted) return
    if (!grant) {
      // No session means no stream and no poll worth making either; the room
      // queries themselves will fail and say so.
      startFallback(stream)
      scheduleRetry(stream)
      return
    }
    // Only a grant in hand retires the demand for a new one, and only once this
    // attempt is known to still own the stream. A forced refresh that failed —
    // offline, throttled, a 5xx — leaves the refused token in place. And a
    // superseded attempt clearing the flag here used to hand the refused bearer
    // straight back to the live attempt: it had a grant, but not one this
    // stream ever asked for.
    stream.renewFirst = false

    const fresh = (): boolean =>
      streams.get(stream.roomId) === stream && stream.generation === attemptGeneration

    const headers: Record<string, string> = { authorization: `Bearer ${grant.token}` }
    if (stream.lastEventId) headers['last-event-id'] = stream.lastEventId

    stream.connection = connect({
      url: `${apiUrl.replace(/\/+$/, '')}/rooms/${encodeURIComponent(stream.roomId)}/events`,
      headers,

      onOpen: () => {
        if (!fresh()) return
        // Not `attempt = 0`. Opening says the server accepted the request, not
        // that this connection will last: a stream that opens and dies seconds
        // later has to back off further, not start over. The counter clears
        // only once this connection has outlived the ceiling it would otherwise
        // wait.
        if (stream.stableTimer) clearTimeout(stream.stableTimer)
        stream.stableTimer = setTimeout(() => {
          stream.stableTimer = null
          if (!fresh()) return
          stream.attempt = 0
        }, SSE_STABLE_AFTER_MS)
        // Opening with no resume point means this connection can replay
        // nothing: whatever happened while the room had no stream is not
        // coming. Swapping straight to the slow safety poll here would leave
        // that gap on screen for its whole interval, so ask once, now.
        if (!stream.lastEventId) refetchSubscribed(stream)
        // The stream carries most events; the slow poll stays for the ones it
        // does not (GoGo-BE#608). Never drop cover entirely.
        poll(stream, 'live')
        setStatus(stream, 'live')
        // Replace the connection before the token it was authorised with dies.
        // The floor is the reconnect ceiling, not the base: if the arithmetic
        // ever says "now", waiting half a minute is the safe way to be wrong.
        const lifetime = Math.max(grant.expiresAt - now() - SSE_TOKEN_MARGIN_MS, SSE_RECONNECT_MAX_MS)
        if (stream.tokenTimer) clearTimeout(stream.tokenTimer)
        stream.tokenTimer = setTimeout(() => {
          stream.tokenTimer = null
          if (!fresh()) return
          closeConnection(stream)
          void open(stream)
        }, lifetime)
      },

      onEvent: event => {
        if (!fresh()) return

        // `heartbeat` and `resync` carry no room sequence. The server leaves
        // their `id` unset and the SSE layer fills in a per-connection counter,
        // so storing one as the resume point asks the next connection to
        // continue from a number that means nothing in this room — replaying
        // everything, or worse, skipping past real events. Only a room event
        // moves the resume point.
        if (event.type === 'heartbeat') return
        if (event.type === 'resync') {
          // Nobody is watching: there is nothing to invalidate now, and the
          // server sends no replay after this gap — so the next screen has to
          // be told to refetch rather than trust a cache the stream skipped.
          if (stream.phases.size === 0) {
            stream.lastEventId = null
            stream.missedWhileIdle = true
            return
          }
          // The gap was wider than the server's replay buffer, so nothing
          // resumed. The id we were holding is exactly the one the server could
          // not honour: keeping it would ask for the same impossible resume on
          // every reconnect and get another resync back.
          stream.lastEventId = null
          // Refetch everything the subscribed phases show rather than carry on
          // from a hole.
          refetchSubscribed(stream)
          return
        }

        // Nobody is watching — the hand-off window. Advancing the resume point
        // here would drop the event twice over: not delivered now, and not
        // replayed when the next screen reuses this same connection.
        if (stream.phases.size === 0) {
          stream.missedWhileIdle = true
          return
        }
        if (event.id) stream.lastEventId = event.id
        if (!interested(stream, event.type)) return

        const planId = planIdOf(event.data)
        for (const queryKey of eventQueryKeys({
          type: event.type,
          roomId: stream.roomId,
          ...(planId ? { planId } : {}),
        })) {
          void stream.queryClient.invalidateQueries({ queryKey })
        }
      },

      onClose: ({ status, retryAfterMs }) => {
        if (!fresh()) return
        stream.connection = null
        if (stream.tokenTimer) {
          clearTimeout(stream.tokenTimer)
          stream.tokenTimer = null
        }
        // This connection is over, so it will never earn the reset.
        if (stream.stableTimer) {
          clearTimeout(stream.stableTimer)
          stream.stableTimer = null
        }

        if (status === ENVIRONMENT_OFF_STATUS) {
          // The backend's own kill switch. It is a fact about the environment,
          // not about this room: every stream on the device goes to polling,
          // including ones already live or still waiting on a token.
          environmentRealtimeOff = true
          for (const other of [...streams.values()]) {
            if (other !== stream) giveUp(other)
          }
          giveUp(stream)
          return
        }
        if (status !== null && ROOM_FATAL_STATUSES.has(status)) {
          giveUp(stream)
          return
        }

        if (status === SSE_RATE_LIMITED_STATUS) {
          // Too many streams for this actor, or too many opens. Knocking again
          // on the usual two-second backoff is what earned the refusal, so wait
          // the time the server named — or a whole limit period when it named
          // none — and keep the room fed by polling meanwhile.
          startFallback(stream)
          // Nothing is watching: the hand-off timer is about to dispose this
          // stream, and a retry scheduled now would open a socket for a screen
          // that has already gone.
          if (stream.phases.size > 0) scheduleRetry(stream, retryAfterMs ?? SSE_RATE_LIMIT_COOLDOWN_MS)
          return
        }

        // A refusal of the credential itself: the next attempt has to carry a
        // different one, however fresh this one still looks locally.
        if (status === 401) stream.renewFirst = true
        // A clean end (the server rotating the stream) or a dropped socket:
        // poll meanwhile and come back.
        startFallback(stream)
        scheduleRetry(stream)
      },
    })
  }

  return {
    kind: 'sse',

    subscribe({ roomId, phase, queryClient, planId, onStatusChange }) {
      let stream = streams.get(roomId)
      if (!stream) {
        const created: SseStream = {
          roomId,
          queryClient,
          phases: new Map(),
          planIds: new Map(),
          listeners: new Set(),
          connection: null,
          opening: null,
          lastEventId: null,
          attempt: 0,
          retryTimer: null,
          tokenTimer: null,
          stableTimer: null,
          graceTimer: null,
          polls: new Map(),
          pollMode: 'down',
          status: 'connecting',
          givenUp: false,
          renewFirst: false,
          missedWhileIdle: false,
          unsubscribeActivity: () => undefined,
          generation: 0,
        }
        // Backgrounded, the socket is dropped rather than left to rot behind a
        // suspended app; foregrounded, it opens again at once.
        created.unsubscribeActivity = activity.subscribe(active => {
          if (streams.get(roomId) !== created) return
          if (active) {
            // Its last screen went while the app was away, so there is nothing
            // to come back to.
            if (created.phases.size === 0) {
              dispose(created)
              return
            }
            created.attempt = 0
            if (created.retryTimer) {
              clearTimeout(created.retryTimer)
              created.retryTimer = null
            }
            void open(created)
          } else {
            closeConnection(created)
            clearTimers(created)
            // `clearTimers` cancels the hand-off window, and a cancelled timer
            // never disposes anything. A stream whose last screen has already
            // gone would have sat in the map forever and reconnected on every
            // return, with nobody watching.
            if (created.phases.size === 0) {
              dispose(created)
            } else {
              // There is no stream behind the room now, so the slow safety
              // cadence is no longer a safety net — it is the only refresh
              // there is. Coming back can take a while (a token to fetch, a
              // socket to open, a hang), and leaving lobby, plan and date on a
              // twenty-second poll is exactly what SSE was meant to end.
              startFallback(created)
            }
          }
        })
        stream = created
        streams.set(roomId, created)
      }

      baselineActor()
      // Something happened while this room had no screen. Whoever arrives gets
      // the room as it is now rather than as it was when the last screen left.
      if (stream.missedWhileIdle) {
        stream.missedWhileIdle = false
        const missed: (readonly unknown[])[] = []
        for (const type of ROOM_PHASE_EVENTS[phase]) {
          missed.push(
            ...eventQueryKeys({
              type,
              roomId,
              ...(planId ? { planId } : {}),
            }),
          )
        }
        invalidateDeduped(queryClient, missed)
      }
      // A screen arriving inside the grace window keeps the connection it
      // would otherwise have replaced.
      if (stream.graceTimer) {
        clearTimeout(stream.graceTimer)
        stream.graceTimer = null
      }
      stream.phases.set(phase, (stream.phases.get(phase) ?? 0) + 1)
      if (planId) {
        // A new plan id changes what the polls underneath have to ask for, so
        // they are rebuilt rather than left describing the previous screen.
        if (!stream.planIds.has(planId)) stopPolls(stream)
        stream.planIds.set(planId, (stream.planIds.get(planId) ?? 0) + 1)
      }
      if (onStatusChange) {
        stream.listeners.add(onStatusChange)
        const current = stream.status
        setTimeout(() => onStatusChange(current), 0)
      }

      // A phase that appeared mid-stream needs its own poller, at whichever
      // cadence the stream is currently running.
      poll(stream, stream.pollMode)
      void open(stream)

      const subscribed = stream
      return () => {
        if (streams.get(roomId) !== subscribed) return
        if (onStatusChange) subscribed.listeners.delete(onStatusChange)

        // The plan id goes with the screen that named it, whether or not
        // another screen of the same phase is still here.
        let rebuildPolls = false
        if (planId) {
          const plansLeft = (subscribed.planIds.get(planId) ?? 1) - 1
          if (plansLeft > 0) subscribed.planIds.set(planId, plansLeft)
          else {
            subscribed.planIds.delete(planId)
            rebuildPolls = true
          }
        }

        const remaining = (subscribed.phases.get(phase) ?? 1) - 1
        if (remaining > 0) subscribed.phases.set(phase, remaining)
        else {
          subscribed.phases.delete(phase)
          const teardown = subscribed.polls.get(phase)
          if (teardown) {
            teardown()
            subscribed.polls.delete(phase)
          }
        }

        if (subscribed.phases.size > 0) {
          // Whoever is left keeps polling for what they are actually showing.
          if (rebuildPolls) {
            stopPolls(subscribed)
            poll(subscribed, subscribed.pollMode)
          }
          return
        }

        // Nothing is watching. Stop polling at once — that is pure waste — but
        // let the stream outlive the gap between one screen unmounting and the
        // next mounting.
        stopPolls(subscribed)
        if (subscribed.graceTimer) clearTimeout(subscribed.graceTimer)
        subscribed.graceTimer = setTimeout(() => {
          subscribed.graceTimer = null
          if (streams.get(roomId) !== subscribed || subscribed.phases.size > 0) return
          dispose(subscribed)
        }, SSE_IDLE_GRACE_MS)
      }
    },
  }
}

/**
 * The transport the app uses. One assignment point: turning the stream off is
 * this line, and no screen knows the difference.
 */
export const roomRealtimeTransport: RoomRealtimeTransport = createSseTransport()

/** Test seam: forget every stream and the environment kill switch. */
export function resetSseTransportForTests(): void {
  for (const stream of streams.values()) {
    if (stream.retryTimer) clearTimeout(stream.retryTimer)
    if (stream.tokenTimer) clearTimeout(stream.tokenTimer)
    if (stream.graceTimer) clearTimeout(stream.graceTimer)
    stream.connection?.close()
    for (const teardown of stream.polls.values()) teardown()
    stream.unsubscribeActivity()
  }
  streams.clear()
  environmentRealtimeOff = false
}
