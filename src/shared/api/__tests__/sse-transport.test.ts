import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { queryKeys } from '../query-keys'
import type { AppActivity } from '../realtime/app-activity'
import { parseSseChunk, type SseConnectOptions } from '../realtime/sse-connection'
import { EXPIRY_SKEW_MS } from '../session'
import {
  createSseTransport,
  resetSseTransportForTests,
  SSE_IDLE_GRACE_MS,
  SSE_RECONNECT_BASE_MS,
  SSE_RECONNECT_MAX_MS,
  SSE_TOKEN_MARGIN_MS,
  createPollingTransport,
  POLL_INTERVAL_MS,
  type RoomRealtimeStatus,
  type RoomRealtimeTransport,
} from '../realtime/transport'

vi.mock('../realtime/app-activity', () => ({
  appActivity: { isActive: () => true, subscribe: () => () => undefined },
}))

const ROOM_ID = 'room-1'
const PLAN_ID = 'plan-7'
const TOKEN_TTL_MS = 15 * 60_000

/** An app whose foreground state the test controls. */
function fakeActivity(initiallyActive = true) {
  let active = initiallyActive
  const listeners = new Set<(active: boolean) => void>()
  const activity: AppActivity = {
    isActive: () => active,
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return {
    activity,
    set(next: boolean) {
      active = next
      for (const listener of listeners) listener(next)
    },
  }
}

/** Every stream the transport opened, still holding its callbacks. */
function fakeConnector() {
  const opened: (SseConnectOptions & { closed: boolean })[] = []
  const connect = (options: SseConnectOptions) => {
    const record = { ...options, closed: false }
    opened.push(record)
    return {
      close() {
        record.closed = true
      },
    }
  }
  return {
    connect,
    opened,
    last: () => opened[opened.length - 1],
  }
}

/** A fallback transport that records what was asked of it. */
function fakeFallback() {
  const subscriptions: { roomId: string; phase: string; planId?: string; active: boolean }[] = []
  const transport: RoomRealtimeTransport = {
    kind: 'polling',
    subscribe({ roomId, phase, planId }) {
      const record = { roomId, phase: String(phase), planId, active: true }
      subscriptions.push(record)
      return () => {
        record.active = false
      }
    },
  }
  return { transport, subscriptions, live: () => subscriptions.filter(s => s.active) }
}

function fakeClient() {
  const client = new QueryClient()
  const invalidated: string[] = []
  vi.spyOn(client, 'invalidateQueries').mockImplementation(filters => {
    invalidated.push(JSON.stringify((filters as { queryKey: unknown }).queryKey))
    return Promise.resolve()
  })
  return { client, keys: () => invalidated.splice(0) }
}

interface Harness {
  transport: RoomRealtimeTransport
  connector: ReturnType<typeof fakeConnector>
  fallback: ReturnType<typeof fakeFallback>
  safety: ReturnType<typeof fakeFallback>
  client: QueryClient
  keys: () => string[]
  activity: ReturnType<typeof fakeActivity>
  statuses: RoomRealtimeStatus[]
  authCalls: () => number
  /** Releases a deferred `auth()`; only for `grant: 'deferred'`. */
  releaseAuth: () => void
  /** The `force` flag each `auth()` call carried, in order. */
  authForced: () => boolean[]
  /** Pushes a new session at the transport, as signing out or in would. */
  setSession: (session: unknown) => void
}

function harness(
  options: {
    enabled?: boolean
    grant?: 'ok' | 'none' | 'deferred' | 'renews-like-the-app'
    /** What the Keychain has read so far; `null` is a cold start. */
    session?: unknown
  } = {},
): Harness {
  const connector = fakeConnector()
  const fallback = fakeFallback()
  const safety = fakeFallback()
  const { client, keys } = fakeClient()
  const activity = fakeActivity()
  let calls = 0
  const forced: boolean[] = []
  let session: unknown =
    'session' in options ? options.session : { kind: 'user', userId: 'u1', expiresAt: 0, accessToken: '' }
  const sessionListeners = new Set<(s: unknown) => void>()
  let held: { token: string; expiresAt: number } | null = null
  let release: (() => void) | null = null
  const transport = createSseTransport({
    connect: connector.connect,
    fallback: fallback.transport,
    safety: safety.transport,
    activity: activity.activity,
    auth: async (opts?: { force?: boolean }) => {
      calls += 1
      forced.push(opts?.force === true)
      if (options.grant === 'none') return null
      if (options.grant === 'renews-like-the-app') {
        // What `currentAccessGrant` really does: hand back the session's token
        // and only renew once inside `EXPIRY_SKEW_MS` of its expiry.
        if (!held || Date.now() >= held.expiresAt - EXPIRY_SKEW_MS) {
          held = { token: `t${calls}`, expiresAt: Date.now() + TOKEN_TTL_MS }
        }
        return held
      }
      const grant = { token: `t${calls}`, expiresAt: Date.now() + TOKEN_TTL_MS }
      if (options.grant !== 'deferred') return grant
      // Hands the test the moment between asking for a token and getting one.
      return new Promise(resolve => {
        release = () => resolve(grant)
      })
    },
    apiUrl: 'https://api.example/v1',
    initialSession: () => session as never,
    onSession: listener => {
      sessionListeners.add(listener as never)
      return () => sessionListeners.delete(listener as never)
    },
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
  })
  return {
    transport,
    connector,
    fallback,
    safety,
    client,
    keys,
    activity,
    statuses: [],
    authCalls: () => calls,
    releaseAuth: () => release?.(),
    authForced: () => forced,
    setSession: next => {
      session = next
      for (const listener of sessionListeners) listener(next)
    },
  }
}

const flush = async () => {
  await vi.advanceTimersByTimeAsync(0)
}

function sse(type: string, payload: unknown, id: string | null = null) {
  return { type, id, data: JSON.stringify({ event_type: type, payload }) }
}

describe('parseSseChunk', () => {
  it('decodes a whole event and keeps the unfinished remainder', () => {
    const { events, rest } = parseSseChunk('event: plan.updated\nid: 32\ndata: {"a":1}\n\nevent: hea')
    expect(events).toEqual([{ type: 'plan.updated', id: '32', data: '{"a":1}' }])
    expect(rest).toBe('event: hea')
  })

  it('joins repeated data lines and drops comments', () => {
    const { events } = parseSseChunk(': keep-alive\ndata: one\ndata: two\n\n')
    expect(events).toEqual([{ type: 'message', id: null, data: 'one\ntwo' }])
  })

  it('reads CRLF framing and a field with no value', () => {
    const { events } = parseSseChunk('event: heartbeat\r\ndata:\r\n\r\n')
    expect(events).toEqual([{ type: 'heartbeat', id: null, data: '' }])
  })

  it('returns nothing until a blank line closes the event', () => {
    const { events, rest } = parseSseChunk('event: vote.changed\ndata: {}')
    expect(events).toEqual([])
    expect(rest).toBe('event: vote.changed\ndata: {}')
  })
})

describe('sseTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    resetSseTransportForTests()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('opens one authorised stream per room and invalidates what an event touches', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()

    expect(h.connector.opened).toHaveLength(1)
    expect(h.connector.last().url).toBe('https://api.example/v1/rooms/room-1/events')
    expect(h.connector.last().headers.authorization).toBe('Bearer t1')
    expect(h.connector.last().headers['last-event-id']).toBeUndefined()

    h.connector.last().onOpen()
    h.keys()
    h.connector.last().onEvent(sse('plan.updated', { planId: 'plan-9' }, '7'))

    expect(h.keys()).toEqual([
      JSON.stringify(queryKeys.roomCurrentPlan(ROOM_ID)),
      JSON.stringify(queryKeys.plan('plan-9')),
    ])
  })

  it('runs one stream however many screens watch the same room', async () => {
    const h = harness()
    const a = h.transport.subscribe({ roomId: ROOM_ID, phase: 'lobby', queryClient: h.client })
    const b = h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()

    expect(h.connector.opened).toHaveLength(1)

    a()
    expect(h.connector.last().closed).toBe(false)
    b()
    await vi.advanceTimersByTimeAsync(SSE_IDLE_GRACE_MS)
    expect(h.connector.last().closed).toBe(true)
  })

  /**
   * Navigating between two screens of the same room unmounts one before the
   * next mounts. Observed on a device: every hop closed the connection and the
   * new one pulled a full replay back down.
   */
  it('survives the gap when one screen hands the room to the next', async () => {
    const h = harness()
    const lobby = h.transport.subscribe({ roomId: ROOM_ID, phase: 'lobby', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()

    lobby()
    // Polling stops immediately — nothing is on screen to keep fresh.
    expect(h.safety.live()).toHaveLength(0)
    expect(h.connector.last().closed).toBe(false)

    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await vi.advanceTimersByTimeAsync(SSE_IDLE_GRACE_MS * 2)
    await flush()

    expect(h.connector.opened).toHaveLength(1)
    expect(h.connector.last().closed).toBe(false)
    expect(h.safety.live().map(s => s.phase)).toEqual(['plan'])
  })

  it('closes the stream once the grace window passes with nothing watching', async () => {
    const h = harness()
    const teardown = h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()

    teardown()
    await vi.advanceTimersByTimeAsync(SSE_IDLE_GRACE_MS + 100)
    expect(h.connector.last().closed).toBe(true)
  })

  /**
   * `heartbeat` and `resync` carry no room sequence; the SSE layer fills their
   * `id` with a per-connection counter. Storing one made the next connection
   * resume from a number meaning nothing in this room — on DEV that replayed
   * 13 KB of history on every reconnect, and with a lower event count it would
   * have skipped real events instead.
   */
  it('never takes a resume point from a heartbeat', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()

    h.connector.last().onEvent(sse('plan.updated', { planId: 'p1' }, '42'))
    h.connector.last().onEvent({ type: 'heartbeat', id: '1', data: '{}' })
    h.connector.last().onClose({ status: null })
    await vi.advanceTimersByTimeAsync(SSE_RECONNECT_BASE_MS)
    await flush()

    expect(h.connector.last().headers['last-event-id']).toBe('42')
  })

  it('refetches everything the screens show when the server says the replay window was exceeded', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()
    h.keys()

    h.connector.last().onEvent({ type: 'resync', id: '3', data: '{"reason":"replay_window_exceeded"}' })

    const keys = h.keys()
    expect(keys).toContain(JSON.stringify(queryKeys.room(ROOM_ID)))
    expect(keys).toContain(JSON.stringify(queryKeys.roomCurrentPlan(ROOM_ID)))
    // And it is not a resume point either.
    h.connector.last().onClose({ status: null })
    await vi.advanceTimersByTimeAsync(SSE_RECONNECT_BASE_MS)
    await flush()
    expect(h.connector.last().headers['last-event-id']).toBeUndefined()
  })

  it('renews the token and retries after a 401 rather than dropping the room to polling', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onClose({ status: 401 })

    await vi.advanceTimersByTimeAsync(SSE_RECONNECT_BASE_MS)
    await flush()
    expect(h.connector.opened).toHaveLength(2)
    expect(h.connector.last().headers.authorization).toBe('Bearer t2')
  })

  it('ignores heartbeats and events no subscribed phase shows, but still tracks the resume point', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()
    h.keys()

    // `plan` watches room.status_changed and plan.updated, not the tally.
    h.connector.last().onEvent({ type: 'heartbeat', id: '1', data: '{}' })
    h.connector.last().onEvent(sse('vote.changed', {}, '12'))
    expect(h.keys()).toEqual([])

    // The resume point still moved, so a reconnect does not replay them.
    h.connector.last().onClose({ status: null })
    await vi.advanceTimersByTimeAsync(SSE_RECONNECT_BASE_MS)
    await flush()
    expect(h.connector.last().headers['last-event-id']).toBe('12')
  })

  it('swaps the full-cadence fallback for the safety poll when the stream comes up, and back when it drops', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'matching', queryClient: h.client })
    await flush()

    h.connector.last().onOpen()
    expect(h.fallback.live()).toHaveLength(0)
    expect(h.safety.live()).toHaveLength(1)
    expect(h.safety.live()[0]).toMatchObject({ roomId: ROOM_ID, phase: 'matching' })

    h.connector.last().onClose({ status: null })
    expect(h.safety.live()).toHaveLength(0)
    expect(h.fallback.live()).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(SSE_RECONNECT_BASE_MS)
    await flush()
    h.connector.last().onOpen()
    expect(h.fallback.live()).toHaveLength(0)
    expect(h.safety.live()).toHaveLength(1)
  })

  /**
   * GoGo-BE#608: finalising a room emits nothing. Measured on DEV `a9da62d`
   * 2026-09-22 — a member's stream saw only a heartbeat for thirty seconds.
   * A live stream must therefore never be the only thing keeping a screen
   * fresh.
   */
  it('keeps a poll running underneath a live stream that delivers no events', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'matching', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()

    h.connector.last().onEvent({ type: 'heartbeat', id: '1', data: '{}' })
    await vi.advanceTimersByTimeAsync(60_000)

    expect(h.safety.live()).toHaveLength(1)
  })

  it('covers a screen that opens while the stream is already live', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'lobby', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()
    expect(h.safety.live()).toHaveLength(1)

    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    expect(h.safety.live().map(s => s.phase).sort()).toEqual(['lobby', 'plan'])
  })

  it('backs off between reconnects and never waits longer than the ceiling', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()

    const waits: number[] = []
    for (let i = 0; i < 6; i += 1) {
      const before = h.connector.opened.length
      h.connector.last().onClose({ status: null })
      // Walk forward until the next attempt appears, recording how long it took.
      let waited = 0
      while (h.connector.opened.length === before && waited <= SSE_RECONNECT_MAX_MS) {
        await vi.advanceTimersByTimeAsync(500)
        await flush()
        waited += 500
      }
      waits.push(waited)
    }

    expect(waits[0]).toBe(SSE_RECONNECT_BASE_MS)
    expect(waits[1]).toBe(SSE_RECONNECT_BASE_MS * 2)
    expect(waits[2]).toBe(SSE_RECONNECT_BASE_MS * 4)
    expect(Math.max(...waits)).toBeLessThanOrEqual(SSE_RECONNECT_MAX_MS)
  })

  it('stops streaming this room when the actor is not allowed on it', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onClose({ status: 403 })

    await vi.advanceTimersByTimeAsync(SSE_RECONNECT_MAX_MS * 4)
    await flush()
    expect(h.connector.opened).toHaveLength(1)
    expect(h.fallback.live()).toHaveLength(1)
  })

  it('takes every room down to polling when the backend says realtime is off', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onClose({ status: 503 })
    await flush()

    h.transport.subscribe({ roomId: 'room-2', phase: 'lobby', queryClient: h.client })
    await vi.advanceTimersByTimeAsync(SSE_RECONNECT_MAX_MS)
    await flush()

    expect(h.connector.opened).toHaveLength(1)
    expect(h.fallback.live().map(s => s.roomId).sort()).toEqual([ROOM_ID, 'room-2'])
  })

  it('polls without opening anything when the client switch is off', async () => {
    const h = harness({ enabled: false })
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()

    expect(h.connector.opened).toHaveLength(0)
    expect(h.fallback.live()).toHaveLength(1)
  })

  it('reports connecting, then live, then polling', async () => {
    const h = harness()
    const seen: RoomRealtimeStatus[] = []
    h.transport.subscribe({
      roomId: ROOM_ID,
      phase: 'plan',
      queryClient: h.client,
      onStatusChange: status => seen.push(status),
    })
    await flush()
    h.connector.last().onOpen()
    await flush()
    h.connector.last().onClose({ status: null })
    await flush()

    expect(seen).toEqual(['connecting', 'live', 'polling'])
  })

  it('never reports status synchronously from subscribe', async () => {
    const h = harness()
    const seen: RoomRealtimeStatus[] = []
    h.transport.subscribe({
      roomId: ROOM_ID,
      phase: 'plan',
      queryClient: h.client,
      onStatusChange: status => seen.push(status),
    })
    expect(seen).toEqual([])
    await flush()
    expect(seen.length).toBeGreaterThan(0)
  })

  it('drops the socket in the background and opens a new one on return', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()

    h.activity.set(false)
    expect(h.connector.last().closed).toBe(true)

    h.activity.set(true)
    await flush()
    expect(h.connector.opened).toHaveLength(2)
    expect(h.connector.last().closed).toBe(false)
  })

  it('replaces the connection before its access token expires', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()
    expect(h.connector.opened).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(TOKEN_TTL_MS - SSE_TOKEN_MARGIN_MS)
    await flush()

    expect(h.connector.opened).toHaveLength(2)
    expect(h.connector.opened[0].closed).toBe(true)
    // A fresh grant, not the one the first connection was authorised with.
    expect(h.connector.last().headers.authorization).toBe('Bearer t2')
  })

  it('polls and keeps trying when there is no session yet', async () => {
    const h = harness({ grant: 'none' })
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()

    expect(h.connector.opened).toHaveLength(0)
    expect(h.fallback.live()).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(SSE_RECONNECT_BASE_MS)
    await flush()
    expect(h.authCalls()).toBeGreaterThan(1)
  })

  /**
   * Review finding, 2026-09-23. Backgrounding while `auth()` was still out left
   * the attempt alive: it read the generation *after* the await, so the
   * invalidation background had just made was invisible to it, and a connection
   * opened for an app that had already gone away.
   */
  it('does not open a stream that was backgrounded while it waited for a token', async () => {
    const h = harness({ grant: 'deferred' })
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    expect(h.connector.opened).toHaveLength(0)

    h.activity.set(false)
    h.releaseAuth()
    await flush()
    await vi.advanceTimersByTimeAsync(SSE_RECONNECT_MAX_MS)

    expect(h.connector.opened).toHaveLength(0)
  })

  it('opens once the app comes back, with a token asked for then', async () => {
    const h = harness({ grant: 'deferred' })
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.activity.set(false)
    h.releaseAuth()
    await flush()

    h.activity.set(true)
    await flush()
    h.releaseAuth()
    await flush()

    expect(h.connector.opened).toHaveLength(1)
    expect(h.connector.last().headers.authorization).toBe('Bearer t2')
  })

  /**
   * Review finding, 2026-09-23. Backgrounding during the hand-off window
   * cancelled the timer that was going to dispose the stream, and nothing else
   * ever did — so a room with no screen left sat in the map and reconnected on
   * every return.
   */
  it('lets go of a stream whose last screen left while the app was in the background', async () => {
    const h = harness()
    const teardown = h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()

    teardown()
    h.activity.set(false)
    await vi.advanceTimersByTimeAsync(SSE_IDLE_GRACE_MS * 3)
    h.activity.set(true)
    await flush()
    await vi.advanceTimersByTimeAsync(SSE_RECONNECT_MAX_MS)
    await flush()

    // The original connection, closed, and nothing raised in its place.
    expect(h.connector.opened).toHaveLength(1)
    expect(h.connector.opened[0].closed).toBe(true)
    expect(h.safety.live()).toHaveLength(0)
    expect(h.fallback.live()).toHaveLength(0)
  })

  it('still hands the room over when the app stays in the foreground', async () => {
    const h = harness()
    const lobby = h.transport.subscribe({ roomId: ROOM_ID, phase: 'lobby', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()

    lobby()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await vi.advanceTimersByTimeAsync(SSE_IDLE_GRACE_MS * 2)
    await flush()

    expect(h.connector.opened).toHaveLength(1)
    expect(h.connector.last().closed).toBe(false)
  })
})

/**
 * Integration gate for #285 + #286. Each branch was green on its own; what
 * neither could show is that adopting the stream keeps the plan a screen is
 * routed by. A date screen opened straight from a plan link reads
 * `plan(planId)`, which no room id names — if the stream forwards only the room
 * to the polls underneath it, the date screen silently stops refreshing again.
 */
describe('sseTransport × a screen routed by plan id', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    resetSseTransportForTests()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const openDateScreen = (h: Harness) =>
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'date', queryClient: h.client, planId: PLAN_ID })

  it('gives the plan id to the safety poll under a live stream', async () => {
    const h = harness()
    openDateScreen(h)
    await flush()
    h.connector.last().onOpen()

    expect(h.safety.live()).toEqual([
      expect.objectContaining({ roomId: ROOM_ID, phase: 'date', planId: PLAN_ID }),
    ])
  })

  it('gives the plan id to the full-cadence poll when the stream is refused', async () => {
    const h = harness()
    openDateScreen(h)
    await flush()
    // The environment has realtime switched off: polling is all there is.
    h.connector.last().onClose({ status: 503 })
    await flush()

    expect(h.fallback.live()).toEqual([
      expect.objectContaining({ roomId: ROOM_ID, phase: 'date', planId: PLAN_ID }),
    ])
  })

  it('gives the plan id to the poll that covers a dropped stream', async () => {
    const h = harness()
    openDateScreen(h)
    await flush()
    h.connector.last().onOpen()
    h.connector.last().onClose({ status: null })

    expect(h.fallback.live()).toEqual([
      expect.objectContaining({ roomId: ROOM_ID, phase: 'date', planId: PLAN_ID }),
    ])
  })

  it('refetches that plan when the server says the replay window was exceeded', async () => {
    const h = harness()
    openDateScreen(h)
    await flush()
    h.connector.last().onOpen()
    h.keys()

    h.connector.last().onEvent({ type: 'resync', id: '9', data: '{"reason":"replay_window_exceeded"}' })

    expect(h.keys()).toContain(JSON.stringify(queryKeys.plan(PLAN_ID)))
  })

  it('stops asking for that plan once the screen showing it has gone', async () => {
    const h = harness()
    const teardown = openDateScreen(h)
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'lobby', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()

    teardown()

    expect(h.safety.live().every(s => s.planId === undefined)).toBe(true)
    expect(h.safety.live().map(s => s.phase)).toEqual(['lobby'])
  })

  /**
   * Review finding, 2026-09-23. The renewal margin sat *outside* the session's
   * own renewal window: at 60 s before expiry `currentAccessGrant` still
   * considered the token good, handed the same one back, and the lifetime
   * arithmetic went negative and clamped to the floor — so the stream
   * reconnected every couple of seconds for the last minute of every token,
   * against a limit of thirty a minute per actor.
   */
  it('renews on a schedule the session will actually honour', () => {
    expect(SSE_TOKEN_MARGIN_MS).toBeLessThan(EXPIRY_SKEW_MS)
  })

  it('replaces the connection about once per token, not once every few seconds', async () => {
    const h = harness({ grant: 'renews-like-the-app' })
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()

    // Walk a whole token lifetime, opening each connection as it appears.
    const end = Date.now() + TOKEN_TTL_MS
    while (Date.now() < end) {
      await vi.advanceTimersByTimeAsync(5_000)
      await flush()
      const last = h.connector.last()
      if (last && !last.closed) last.onOpen()
    }

    // One renewal near the end, not a reconnect loop.
    expect(h.connector.opened.length).toBeLessThanOrEqual(3)
  })

  it('drops a resume point the server has just refused', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()
    h.connector.last().onEvent(sse('plan.updated', { planId: 'p1' }, '11'))

    h.connector.last().onEvent({ type: 'resync', id: '12', data: '{"reason":"replay_window_exceeded"}' })
    h.connector.last().onClose({ status: null })
    await vi.advanceTimersByTimeAsync(SSE_RECONNECT_BASE_MS)
    await flush()

    // Asking to resume from the id the server could not honour would earn
    // another resync, and another full refetch, on every reconnect.
    expect(h.connector.last().headers['last-event-id']).toBeUndefined()
  })

  /**
   * Review finding, 2026-09-23. Both pollers this factory makes — the
   * full-cadence fallback and the slow safety net — shared one module-level
   * registry, so the same room subscribed on both collided on one key.
   */
  it('keeps two polling transports out of each other\'s registry', async () => {
    const fallback = fakeClient()
    const safety = fakeClient()
    const { activity } = fakeActivity()
    const a = createPollingTransport(activity)
    const b = createPollingTransport(activity)

    a.subscribe({ roomId: ROOM_ID, phase: 'lobby', queryClient: fallback.client })
    b.subscribe({ roomId: ROOM_ID, phase: 'lobby', queryClient: safety.client })

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS.lobby)
    await flush()

    expect(fallback.keys().length).toBeGreaterThan(0)
    expect(safety.keys().length).toBeGreaterThan(0)
  })

  /**
   * Second-pass review findings, 2026-09-23.
   */
  it('renews the credential the server just refused instead of resending it', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    expect(h.authForced()).toEqual([false])

    h.connector.last().onClose({ status: 401 })
    await vi.advanceTimersByTimeAsync(SSE_RECONNECT_BASE_MS)
    await flush()

    // A token that still looks fresh locally is exactly the one that was
    // refused; the retry has to ask for a different one.
    expect(h.authForced()).toEqual([false, true])
  })

  it('does not renew again once the refusal is behind it', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onClose({ status: 401 })
    await vi.advanceTimersByTimeAsync(SSE_RECONNECT_BASE_MS)
    await flush()
    h.connector.last().onClose({ status: null })
    await vi.advanceTimersByTimeAsync(SSE_RECONNECT_MAX_MS)
    await flush()

    expect(h.authForced().slice(2)).toEqual([false])
  })

  it('makes a new screen wait out the backoff rather than reopen at once', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onClose({ status: null })
    expect(h.connector.opened).toHaveLength(1)

    // Navigating to another screen of the same room must not jump the queue —
    // that is how a rate-limited room gets hit again on every hop.
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'lobby', queryClient: h.client })
    await flush()
    expect(h.connector.opened).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(SSE_RECONNECT_BASE_MS)
    await flush()
    expect(h.connector.opened).toHaveLength(2)
  })

  it('lets go of a refused stream that already has nothing watching it', async () => {
    const h = harness()
    const teardown = h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()

    teardown()
    // The refusal lands while the hand-off window is still open.
    h.connector.last().onClose({ status: 403 })
    await vi.advanceTimersByTimeAsync(SSE_IDLE_GRACE_MS * 3)

    // Nothing left polling, and coming back raises nothing.
    expect(h.fallback.live()).toHaveLength(0)
    expect(h.safety.live()).toHaveLength(0)
    h.activity.set(false)
    h.activity.set(true)
    await flush()
    expect(h.connector.opened).toHaveLength(1)
  })

  it('takes every room to polling when the environment switch answers, not just the one that asked', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    h.transport.subscribe({ roomId: 'room-2', phase: 'lobby', queryClient: h.client })
    await flush()
    h.connector.opened.forEach(c => !c.closed && c.onOpen())
    expect(h.safety.live()).toHaveLength(2)

    h.connector.opened[0].onClose({ status: 503 })
    await flush()

    // Both rooms, not only the one that received the answer.
    expect(h.fallback.live().map(s => s.roomId).sort()).toEqual([ROOM_ID, 'room-2'])
    expect(h.safety.live()).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(SSE_RECONNECT_MAX_MS * 2)
    await flush()
    expect(h.connector.opened).toHaveLength(2)
  })

  /**
   * Third-pass review findings, 2026-09-23.
   */
  it('lets go of every stream when the person signs out', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()

    h.setSession(null)

    // The bearer is already on that request: leaving it open keeps delivering
    // the previous person's rooms until their token rotates.
    expect(h.connector.last().closed).toBe(true)
    expect(h.safety.live()).toHaveLength(0)
  })

  it('lets go when a different person signs in', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()

    h.setSession({ kind: 'user', userId: 'someone-else', expiresAt: 0, accessToken: '' })

    expect(h.connector.last().closed).toBe(true)
  })

  it('keeps the stream through a token refresh', async () => {
    const h = harness()
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()

    // Same actor, new token: nothing to tear down.
    h.setSession({ kind: 'user', userId: 'u1', expiresAt: 1, accessToken: 'new' })

    expect(h.connector.last().closed).toBe(false)
  })

  it('does not let a stale attempt hand the room to a third one', async () => {
    const h = harness({ grant: 'deferred' })
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()

    // Background and return while the first `auth()` is still out.
    h.activity.set(false)
    h.activity.set(true)
    await flush()
    // Release both: the stale one must not clear the flag the live one owns.
    h.releaseAuth()
    await flush()
    h.releaseAuth()
    await flush()

    expect(h.connector.opened.length).toBeLessThanOrEqual(1)
  })

  /**
   * Fourth-pass review findings, 2026-09-23.
   */
  it('treats the first session after a cold start as hydration, not a sign-out', async () => {
    // A cold deep link: the transport is asked for a stream before the Keychain
    // has been read, so the baseline it takes is "nobody".
    const h = harness({ session: null })
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()

    h.setSession({ kind: 'user', userId: 'u1', expiresAt: 0, accessToken: '' })

    // Tearing it down here kills the stream for good: nothing resubscribes.
    expect(h.connector.last().closed).toBe(false)
    expect(h.safety.live()).toHaveLength(1)
  })

  it('still lets go when that hydrated person signs out', async () => {
    const h = harness({ session: null })
    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()
    h.setSession({ kind: 'user', userId: 'u1', expiresAt: 0, accessToken: '' })
    h.setSession(null)

    expect(h.connector.last().closed).toBe(true)
  })

  it('refetches what arrived while the room had no screen', async () => {
    const h = harness()
    const teardown = h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()

    teardown()
    // Inside the hand-off window: the connection is kept, so this event is not
    // replayed to whoever comes next.
    h.connector.last().onEvent(sse('plan.updated', { planId: PLAN_ID }, '21'))
    h.keys()

    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client, planId: PLAN_ID })
    await flush()

    expect(h.keys()).toContain(JSON.stringify(queryKeys.plan(PLAN_ID)))
  })

  it('does not move the resume point past an event nobody received', async () => {
    const h = harness()
    const teardown = h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await flush()
    h.connector.last().onOpen()
    h.connector.last().onEvent(sse('plan.updated', { planId: PLAN_ID }, '30'))

    teardown()
    h.connector.last().onEvent(sse('plan.updated', { planId: PLAN_ID }, '31'))
    h.connector.last().onClose({ status: null })

    h.transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: h.client })
    await vi.advanceTimersByTimeAsync(SSE_RECONNECT_BASE_MS)
    await flush()

    // Resuming from 31 would skip the event that was never delivered.
    expect(h.connector.last().headers['last-event-id']).toBe('30')
  })
})
