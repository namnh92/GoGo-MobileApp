import type { QueryClient } from '@tanstack/react-query'

import { currentAccessGrant } from '../client'
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

const pollers = new Map<string, RoomPoller>()

export function createPollingTransport(
  activity: AppActivity = appActivity,
  intervals: Record<RoomPhase, number> = POLL_INTERVAL_MS,
): RoomRealtimeTransport {
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

/** The fallback, and what every SSE stream degrades to. See `createPollingTransport`. */
export const pollingTransport: RoomRealtimeTransport = createPollingTransport()

/** The slow poll that keeps running underneath a live stream. */
export const safetyPollingTransport: RoomRealtimeTransport = createPollingTransport(
  appActivity,
  SAFETY_POLL_INTERVAL_MS,
)

/** Test seam: forget every room poller. */
export function resetPollingTransportForTests(): void {
  for (const poller of pollers.values()) {
    if (poller.timer) clearTimeout(poller.timer)
    poller.unsubscribeActivity()
  }
  pollers.clear()
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
 * Reconnect this long before the access token expires. A stream authorised
 * once keeps running with a token the rest of the app has already rotated;
 * replacing the connection early is cheaper than discovering it went stale.
 */
export const SSE_TOKEN_MARGIN_MS = 60_000

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
  /** A bearer good for a stream, and when it stops being one. */
  auth?: () => Promise<{ token: string; expiresAt: number } | null>
  /** Base URL including `/v1`; defaults to the app's configured API. */
  apiUrl?: string
  /** Client kill switch. `false` never opens a stream and polls instead. */
  enabled?: boolean
  now?: () => number
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
  /** An open is already in flight; its `auth()` has not answered yet. */
  opening: boolean
  lastEventId: string | null
  attempt: number
  retryTimer: ReturnType<typeof setTimeout> | null
  tokenTimer: ReturnType<typeof setTimeout> | null
  /** Set while the stream is outliving its last subscriber. */
  graceTimer: ReturnType<typeof setTimeout> | null
  /** One poll subscription per distinct phase, at whichever cadence `pollMode` names. */
  polls: Map<RoomPhase, () => void>
  /** `down` is the full-cadence fallback; `live` is the slow safety poll. */
  pollMode: 'down' | 'live'
  status: RoomRealtimeStatus
  /** This room will not get a stream again; poll and stop trying. */
  givenUp: boolean
  unsubscribeActivity: () => void
  /** Guards callbacks from a connection that has already been replaced. */
  generation: number
}

const streams = new Map<string, SseStream>()

/** Set by a 503: the backend says realtime is off here, for every room. */
let environmentRealtimeOff = false

export function createSseTransport(options: SseTransportOptions = {}): RoomRealtimeTransport {
  const connect = options.connect ?? xhrSseConnector
  const fallback = options.fallback ?? pollingTransport
  const safety = options.safety ?? safetyPollingTransport
  const activity = options.activity ?? appActivity
  const auth = options.auth ?? currentAccessGrant
  const apiUrl = options.apiUrl ?? env.apiUrl
  const enabled = options.enabled ?? true
  const now = options.now ?? Date.now

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
    if (stream.graceTimer) clearTimeout(stream.graceTimer)
    stream.retryTimer = null
    stream.tokenTimer = null
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

  const closeConnection = (stream: SseStream) => {
    stream.generation += 1
    stream.connection?.close()
    stream.connection = null
    stream.opening = false
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

  const scheduleRetry = (stream: SseStream) => {
    if (stream.givenUp || stream.retryTimer) return
    const wait = Math.min(SSE_RECONNECT_BASE_MS * 2 ** stream.attempt, SSE_RECONNECT_MAX_MS)
    stream.attempt += 1
    stream.retryTimer = setTimeout(() => {
      stream.retryTimer = null
      void open(stream)
    }, wait)
  }

  /** Stop streaming this room for good; polling carries it from here. */
  const giveUp = (stream: SseStream) => {
    stream.givenUp = true
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
    // A stream is for the screens watching it. During the hand-off window the
    // existing connection is deliberately kept, but nothing here may open a new
    // one for a room nobody is looking at.
    if (stream.phases.size === 0) return
    // Two screens subscribing in the same tick both reach here before either
    // `auth()` has answered, which used to open the room twice.
    if (stream.connection || stream.opening) return
    stream.opening = true

    // Only the first attempt reads as "connecting"; a reconnect behind a live
    // poll is still polling as far as a screen is concerned.
    if (stream.polls.size === 0) setStatus(stream, 'connecting')

    // Captured before the await, not after. Backgrounding invalidates the
    // attempt in flight by moving the generation on; reading it afterwards
    // picked up that new value and opened a connection for an app that had
    // already gone away.
    const attemptGeneration = stream.generation
    const grant = await auth().catch(() => null)
    // Whatever happened while we waited decides this, not the fact that a token
    // arrived: the stream may have been disposed, given up, superseded by a
    // newer attempt, lost its last screen, or the app may have backgrounded.
    const stillWanted =
      streams.get(stream.roomId) === stream &&
      !stream.givenUp &&
      stream.generation === attemptGeneration &&
      stream.phases.size > 0 &&
      activity.isActive()
    if (stream.opening) stream.opening = false
    if (!stillWanted) return
    if (!grant) {
      // No session means no stream and no poll worth making either; the room
      // queries themselves will fail and say so.
      startFallback(stream)
      scheduleRetry(stream)
      return
    }

    const fresh = (): boolean =>
      streams.get(stream.roomId) === stream && stream.generation === attemptGeneration

    const headers: Record<string, string> = { authorization: `Bearer ${grant.token}` }
    if (stream.lastEventId) headers['last-event-id'] = stream.lastEventId

    stream.connection = connect({
      url: `${apiUrl.replace(/\/+$/, '')}/rooms/${encodeURIComponent(stream.roomId)}/events`,
      headers,

      onOpen: () => {
        if (!fresh()) return
        stream.attempt = 0
        // The stream carries most events; the slow poll stays for the ones it
        // does not (GoGo-BE#608). Never drop cover entirely.
        poll(stream, 'live')
        setStatus(stream, 'live')
        // Replace the connection before the token it was authorised with dies.
        const lifetime = Math.max(grant.expiresAt - now() - SSE_TOKEN_MARGIN_MS, SSE_RECONNECT_BASE_MS)
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
          // The gap was wider than the server's replay buffer, so nothing
          // resumed. Refetch everything the subscribed phases show rather than
          // carry on from a hole.
          const planIds = stream.planIds.size > 0 ? [...stream.planIds.keys()] : [undefined]
          for (const phase of stream.phases.keys()) {
            for (const type of ROOM_PHASE_EVENTS[phase]) {
              for (const planId of planIds) {
                for (const queryKey of eventQueryKeys({
                  type,
                  roomId: stream.roomId,
                  ...(planId ? { planId } : {}),
                })) {
                  void stream.queryClient.invalidateQueries({ queryKey })
                }
              }
            }
          }
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

      onClose: ({ status }) => {
        if (!fresh()) return
        stream.connection = null
        if (stream.tokenTimer) {
          clearTimeout(stream.tokenTimer)
          stream.tokenTimer = null
        }

        if (status === ENVIRONMENT_OFF_STATUS) {
          // The backend's own kill switch. Nothing on this device will get a
          // stream until it restarts, so stop asking every room separately.
          environmentRealtimeOff = true
          giveUp(stream)
          return
        }
        if (status !== null && ROOM_FATAL_STATUSES.has(status)) {
          giveUp(stream)
          return
        }

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
          opening: false,
          lastEventId: null,
          attempt: 0,
          retryTimer: null,
          tokenTimer: null,
          graceTimer: null,
          polls: new Map(),
          pollMode: 'down',
          status: 'connecting',
          givenUp: false,
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
            if (created.phases.size === 0) dispose(created)
          }
        })
        stream = created
        streams.set(roomId, created)
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
