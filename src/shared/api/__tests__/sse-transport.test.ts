import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { queryKeys } from '../query-keys'
import type { AppActivity } from '../realtime/app-activity'
import { parseSseChunk, type SseConnectOptions } from '../realtime/sse-connection'
import {
  createSseTransport,
  resetSseTransportForTests,
  SSE_RECONNECT_BASE_MS,
  SSE_RECONNECT_MAX_MS,
  SSE_TOKEN_MARGIN_MS,
  type RoomRealtimeStatus,
  type RoomRealtimeTransport,
} from '../realtime/transport'

vi.mock('../realtime/app-activity', () => ({
  appActivity: { isActive: () => true, subscribe: () => () => undefined },
}))

const ROOM_ID = 'room-1'
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
  const subscriptions: { roomId: string; phase: string; active: boolean }[] = []
  const transport: RoomRealtimeTransport = {
    kind: 'polling',
    subscribe({ roomId, phase }) {
      const record = { roomId, phase: String(phase), active: true }
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
}

function harness(options: { enabled?: boolean; grant?: 'ok' | 'none' } = {}): Harness {
  const connector = fakeConnector()
  const fallback = fakeFallback()
  const safety = fakeFallback()
  const { client, keys } = fakeClient()
  const activity = fakeActivity()
  let calls = 0
  const transport = createSseTransport({
    connect: connector.connect,
    fallback: fallback.transport,
    safety: safety.transport,
    activity: activity.activity,
    auth: async () => {
      calls += 1
      return options.grant === 'none' ? null : { token: `t${calls}`, expiresAt: Date.now() + TOKEN_TTL_MS }
    },
    apiUrl: 'https://api.example/v1',
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
    expect(h.connector.last().closed).toBe(true)
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
})
