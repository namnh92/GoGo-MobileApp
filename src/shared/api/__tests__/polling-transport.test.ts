import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { queryKeys } from '../query-keys'
import type { AppActivity } from '../realtime/app-activity'
import { ROOM_PHASE_EVENTS } from '../realtime/room-events'
import {
  createPollingTransport,
  IDLE_BACKOFF_MAX_MULTIPLIER,
  POLL_INTERVAL_MS,
  resetPollingTransportForTests,
} from '../realtime/transport'

vi.mock('../realtime/app-activity', () => ({
  appActivity: { isActive: () => true, subscribe: () => () => undefined },
}))

const ROOM_ID = 'room-1'

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
  const set = (next: boolean) => {
    active = next
    for (const listener of listeners) listener(next)
  }
  return { activity, set }
}

/**
 * A query client whose refetches resolve immediately and whose data the test
 * can change between ticks, so idle detection has something to detect.
 */
function fakeClient() {
  const client = new QueryClient()
  const invalidated: string[] = []
  vi.spyOn(client, 'invalidateQueries').mockImplementation(filters => {
    invalidated.push(JSON.stringify((filters as { queryKey: unknown }).queryKey))
    return Promise.resolve()
  })
  const keysPerTick = () => invalidated.splice(0)
  return { client, keysPerTick }
}

async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms)
}

describe('pollingTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    resetPollingTransportForTests()
    vi.useRealTimers()
  })

  it('invalidates each key once per tick, with descendants folded into their ancestor', async () => {
    const { activity } = fakeActivity()
    const { client, keysPerTick } = fakeClient()
    const transport = createPollingTransport(activity)

    const teardown = transport.subscribe({ roomId: ROOM_ID, phase: 'matching', queryClient: client })
    await advance(POLL_INTERVAL_MS.matching)

    // matching replays seven events; they touch room(id) and roomSuggestions(id),
    // and roomSuggestions sits under room, so one invalidation does the work.
    expect(keysPerTick()).toEqual([JSON.stringify(queryKeys.room(ROOM_ID))])
    teardown()
  })

  it('sends the lobby one room invalidation per tick while it watches the run and the plan (#198)', async () => {
    const { activity } = fakeActivity()
    const { client, keysPerTick } = fakeClient()
    const transport = createPollingTransport(activity)

    const teardown = transport.subscribe({ roomId: ROOM_ID, phase: 'lobby', queryClient: client })
    await advance(POLL_INTERVAL_MS.lobby)

    // Suggestions and the current plan sit under room(id). The one invalidation
    // is not one request: every enabled query beneath it refetches.
    expect(keysPerTick()).toEqual([JSON.stringify(queryKeys.room(ROOM_ID))])
    teardown()
  })

  it('runs one poller per room however many screens subscribe', async () => {
    const { activity } = fakeActivity()
    const { client, keysPerTick } = fakeClient()
    const transport = createPollingTransport(activity)

    // A navigation stack: lobby, waiting (lobby), swipe (matching), result (matching).
    const teardowns = [
      transport.subscribe({ roomId: ROOM_ID, phase: 'lobby', queryClient: client }),
      transport.subscribe({ roomId: ROOM_ID, phase: 'lobby', queryClient: client }),
      transport.subscribe({ roomId: ROOM_ID, phase: 'matching', queryClient: client }),
      transport.subscribe({ roomId: ROOM_ID, phase: 'matching', queryClient: client }),
    ]

    await advance(POLL_INTERVAL_MS.matching)
    // Four subscribers, one tick, one key: the fastest phase sets the cadence
    // and the union of their keys collapses to the room.
    expect(keysPerTick()).toEqual([JSON.stringify(queryKeys.room(ROOM_ID))])

    for (const teardown of teardowns) teardown()
    await advance(POLL_INTERVAL_MS.lobby * 10)
    expect(keysPerTick()).toEqual([])
  })

  it('keeps the fastest cadence only while a subscriber needs it', async () => {
    const { activity } = fakeActivity()
    const { client, keysPerTick } = fakeClient()
    const transport = createPollingTransport(activity)

    const lobby = transport.subscribe({ roomId: ROOM_ID, phase: 'lobby', queryClient: client })
    const matching = transport.subscribe({ roomId: ROOM_ID, phase: 'matching', queryClient: client })

    await advance(POLL_INTERVAL_MS.matching)
    expect(keysPerTick()).toHaveLength(1)

    matching()
    // Back to lobby cadence: nothing at 4s, a tick at 5s.
    await advance(POLL_INTERVAL_MS.matching)
    expect(keysPerTick()).toHaveLength(0)
    await advance(POLL_INTERVAL_MS.lobby - POLL_INTERVAL_MS.matching)
    expect(keysPerTick()).toHaveLength(1)
    lobby()
  })

  it('stops while the app is in the background and asks at once when it returns', async () => {
    const { activity, set } = fakeActivity()
    const { client, keysPerTick } = fakeClient()
    const transport = createPollingTransport(activity)

    const teardown = transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: client })
    set(false)
    await advance(POLL_INTERVAL_MS.plan * 5)
    expect(keysPerTick()).toEqual([])

    set(true)
    await advance(0)
    expect(keysPerTick()).toHaveLength(1)
    teardown()
  })

  it('backs off while nothing changes and returns to base cadence on the first change', async () => {
    const { activity } = fakeActivity()
    const { client, keysPerTick } = fakeClient()
    const transport = createPollingTransport(activity)
    const base = POLL_INTERVAL_MS.plan

    const teardown = transport.subscribe({ roomId: ROOM_ID, phase: 'plan', queryClient: client })

    // Nothing in the cache, nothing changes: base, 2×, 4×, then held at the cap.
    await advance(base)
    expect(keysPerTick()).toHaveLength(1)
    await advance(base * 2)
    expect(keysPerTick()).toHaveLength(1)
    await advance(base * 4)
    expect(keysPerTick()).toHaveLength(1)
    await advance(base * IDLE_BACKOFF_MAX_MULTIPLIER)
    expect(keysPerTick()).toHaveLength(1)

    // The next refetch brings new data. The comparison is by reference, so a
    // new object written during the tick is a change.
    vi.mocked(client.invalidateQueries).mockImplementationOnce(() => {
      client.setQueryData(queryKeys.room(ROOM_ID), { id: ROOM_ID, status: 'active' })
      return Promise.resolve()
    })
    await advance(base * IDLE_BACKOFF_MAX_MULTIPLIER)
    keysPerTick()
    // The change reset the backoff: the next tick is one base interval away.
    await advance(base)
    expect(keysPerTick()).toHaveLength(1)
    teardown()
  })

  it('never lets a slow tick overlap the next one', async () => {
    const { activity } = fakeActivity()
    const client = new QueryClient()
    const pending: { resolve?: () => void } = {}
    const calls: number[] = []
    vi.spyOn(client, 'invalidateQueries').mockImplementation(() => {
      calls.push(Date.now())
      return new Promise<void>(resolve => {
        pending.resolve = resolve
      })
    })
    const transport = createPollingTransport(activity)
    const teardown = transport.subscribe({ roomId: ROOM_ID, phase: 'matching', queryClient: client })

    await advance(POLL_INTERVAL_MS.matching)
    expect(calls).toHaveLength(1)
    // The refetch is still running three intervals later; no second request.
    await advance(POLL_INTERVAL_MS.matching * 3)
    expect(calls).toHaveLength(1)

    pending.resolve?.()
    // Nothing changed, so the next tick is one backoff step out — scheduled
    // from the end of the slow tick, not from when it should have fired.
    await advance(POLL_INTERVAL_MS.matching * 2)
    expect(calls).toHaveLength(2)
    teardown()
  })

  /**
   * A phase that declares events but no cadence would subscribe and then never
   * ask the server for anything — which is how the date screen (#285) looked
   * from the outside before it had a phase at all.
   */
  it('gives every phase a cadence', () => {
    for (const phase of Object.keys(ROOM_PHASE_EVENTS) as (keyof typeof ROOM_PHASE_EVENTS)[]) {
      expect(POLL_INTERVAL_MS[phase]).toBeGreaterThan(0)
    }
  })

  it('asks on the date as often as it asks while matching', async () => {
    const { activity } = fakeActivity()
    const { client, keysPerTick } = fakeClient()
    const transport = createPollingTransport(activity)
    transport.subscribe({ roomId: ROOM_ID, phase: 'date', queryClient: client })

    await advance(POLL_INTERVAL_MS.date)
    expect(keysPerTick().length).toBeGreaterThan(0)
    expect(POLL_INTERVAL_MS.date).toBeLessThanOrEqual(POLL_INTERVAL_MS.plan)
  })

  /**
   * #285 — the date screen subscribed and still never refetched the plan it was
   * showing. `plan.updated` refreshes `roomCurrentPlan(roomId)`, but a screen
   * routed by plan id reads `plan(planId)`, and the poller has no way to guess
   * that id. On a device this looked exactly like no subscription at all.
   */
  it('refreshes the plan a screen named, not only the room\'s current plan', async () => {
    const { activity } = fakeActivity()
    const { client, keysPerTick } = fakeClient()
    const transport = createPollingTransport(activity)
    transport.subscribe({ roomId: ROOM_ID, phase: 'date', queryClient: client, planId: 'plan-9' })

    await advance(POLL_INTERVAL_MS.date)

    const keys = keysPerTick()
    expect(keys).toContain(JSON.stringify(queryKeys.plan('plan-9')))
    // `roomCurrentPlan` lives under `room`, which is already being invalidated,
    // so it is folded into its ancestor rather than sent twice. The plan the
    // screen named is a separate key space and has to be asked for by name.
    expect(keys).toContain(JSON.stringify(queryKeys.room(ROOM_ID)))
  })

  it('stops asking for a plan once the screen that named it has gone', async () => {
    const { activity } = fakeActivity()
    const { client, keysPerTick } = fakeClient()
    const transport = createPollingTransport(activity)
    const dated = transport.subscribe({ roomId: ROOM_ID, phase: 'date', queryClient: client, planId: 'plan-9' })
    transport.subscribe({ roomId: ROOM_ID, phase: 'lobby', queryClient: client })

    await advance(POLL_INTERVAL_MS.date)
    keysPerTick()

    dated()
    await advance(POLL_INTERVAL_MS.lobby)
    expect(keysPerTick()).not.toContain(JSON.stringify(queryKeys.plan('plan-9')))
  })
})
