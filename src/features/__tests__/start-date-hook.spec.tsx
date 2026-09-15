import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'

/**
 * #251 — "Bắt đầu đi" never moved the room to `active`, so every stop
 * completion and check-in answered 409 ROOM_NOT_ACTIVE. These pin the hook that
 * now performs the transition against a faked HTTP client, and assert what an
 * observer sees — the requests that actually go out — rather than which cache
 * calls the hook happens to make.
 */

const mockPatch = jest.fn()
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('@/shared/api/client', () => {
  const actual = jest.requireActual('@/shared/api/client')
  return {
    ...actual,
    api: {
      ...actual.api,
      patch: (...args: unknown[]) => mockPatch(...args),
      get: (...args: unknown[]) => mockGet(...args),
      post: (...args: unknown[]) => mockPost(...args),
    },
  }
})

import { ApiError, NetworkError } from '@/shared/api/errors'
import { useCheckinPlanStop, useCompletePlanStop, useCurrentPlan, usePlan } from '@/shared/api/queries/use-plans'
import { useMyRooms, useRoom, useStartDate } from '@/shared/api/queries/use-rooms'

const readyRoom = { id: 'room-1', status: 'ready', myRole: 'host' }
const activeRoom = { id: 'room-1', status: 'active', myRole: 'host' }
const plan = { id: 'plan-1', roomId: 'room-1', stops: [] }
const invalidTransition = new ApiError(409, {
  code: 'INVALID_ROOM_TRANSITION',
  message: 'Cannot move room from active to active',
})

const ROOM = '/rooms/{id}'
const PLAN = '/plans/{id}'
const CURRENT_PLAN = '/rooms/{roomId}/plans/current'
const ROOM_LIST = '/rooms'

/** Answers every read by path, with whatever the server holds right now. */
const server = { room: readyRoom as unknown }
function reads(path: string): number {
  return mockGet.mock.calls.filter(([called]) => called === path).length
}

let client: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

/** Every cache a screen around the start button observes. */
function useObservedRoom() {
  return {
    room: useRoom('room-1'),
    plan: usePlan('plan-1'),
    currentPlan: useCurrentPlan('room-1'),
    list: useMyRooms(),
    startDate: useStartDate('room-1', 'plan-1'),
  }
}

async function renderObserved() {
  const rendered = await renderHook(useObservedRoom, { wrapper })
  await waitFor(() => {
    const current = rendered.result.current
    expect(current.room.isSuccess && current.plan.isSuccess && current.currentPlan.isSuccess && current.list.isSuccess).toBe(true)
  })
  return rendered
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}

// Deliver TanStack's observer notifications inside the act that caused them.
beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity }, queries: { retry: false, gcTime: Infinity } },
  })
  // mockReset also drops queued once-answers, so none leak between tests.
  for (const mock of [mockPatch, mockGet, mockPost]) mock.mockReset()
  server.room = readyRoom
  mockGet.mockImplementation(async (path: string) => {
    if (path === ROOM) return server.room
    if (path === ROOM_LIST) return { items: [], nextCursor: null }
    return plan
  })
})
afterEach(() => client.clear())

describe('useStartDate', () => {
  it('moves the room to active, then the room, its plan and the Plans tabs read again', async () => {
    mockPatch.mockResolvedValue(activeRoom)
    const { result } = await renderObserved()
    const before = { room: reads(ROOM), plan: reads(PLAN), current: reads(CURRENT_PLAN), list: reads(ROOM_LIST) }
    server.room = activeRoom

    let started: unknown
    await act(async () => {
      started = await result.current.startDate.start()
    })

    expect(started).toEqual(activeRoom)
    expect(mockPatch).toHaveBeenCalledTimes(1)
    expect(mockPatch).toHaveBeenCalledWith('/rooms/{id}/status', { status: 'active' }, { pathParams: { id: 'room-1' } })
    await waitFor(() => {
      expect(reads(ROOM)).toBeGreaterThan(before.room)
      expect(reads(PLAN)).toBeGreaterThan(before.plan)
      expect(reads(CURRENT_PLAN)).toBeGreaterThan(before.current)
      expect(reads(ROOM_LIST)).toBeGreaterThan(before.list)
      expect(result.current.room.isFetching || result.current.list.isFetching).toBe(false)
    })
    expect(result.current.room.data).toEqual(activeRoom)
  })

  it('sends one request, and reports one send, when start is called twice before the first answers', async () => {
    const answer = deferred<unknown>()
    mockPatch.mockReturnValue(answer.promise)
    const onSend = jest.fn()
    const { result } = await renderHook(() => useStartDate('room-1', 'plan-1'), { wrapper })

    let first: Promise<unknown> | undefined
    let second: Promise<unknown> | undefined
    await act(async () => {
      first = result.current.start({ onSend })
      second = result.current.start({ onSend })
    })
    expect(mockPatch).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledTimes(1)
    // The joined call does nothing, so its caller must not navigate either.
    await expect(second).resolves.toBeNull()

    await act(async () => {
      answer.resolve(activeRoom)
      await first
    })
    await expect(first).resolves.toEqual(activeRoom)
    expect(mockPatch).toHaveBeenCalledTimes(1)
  })

  it('reports a failure without retrying on its own, and the next start retries', async () => {
    mockPatch.mockRejectedValueOnce(new NetworkError()).mockResolvedValueOnce(activeRoom)
    // The app's client retries mutations by default; this one must not.
    const { createQueryClient } = jest.requireActual('@/shared/api/query-client')
    client = createQueryClient()
    const { result } = await renderHook(() => useStartDate('room-1', 'plan-1'), { wrapper })

    await act(async () => {
      await result.current.start().catch(() => undefined)
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(mockPatch).toHaveBeenCalledTimes(1)

    let started: unknown
    await act(async () => {
      started = await result.current.start()
    })
    expect(started).toEqual(activeRoom)
    expect(mockPatch).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('treats a room that is already active as started', async () => {
    mockPatch.mockRejectedValue(invalidTransition)
    server.room = activeRoom
    const { result } = await renderObserved()

    let started: unknown
    await act(async () => {
      started = await result.current.startDate.start()
    })
    expect(started).toEqual(activeRoom)
    await waitFor(() => expect(result.current.startDate.isSuccess).toBe(true))
    expect(result.current.room.data).toEqual(activeRoom)
  })

  it('rethrows a 409 when the room is not active, and the room reads again', async () => {
    mockPatch.mockRejectedValue(invalidTransition)
    server.room = { ...readyRoom, status: 'matching' }
    const { result } = await renderObserved()
    const before = reads(ROOM)

    let caught: unknown
    await act(async () => {
      caught = await result.current.startDate.start().catch((error: unknown) => error)
    })
    expect(caught).toBe(invalidTransition)
    await waitFor(() => expect(result.current.room.data).toMatchObject({ status: 'matching' }))
    expect(reads(ROOM)).toBeGreaterThan(before)
  })

  it('reads the room again when the caller is refused as not the host', async () => {
    mockPatch.mockRejectedValue(new ApiError(403, { code: 'HOST_ONLY', message: 'Only the host' }))
    server.room = { ...readyRoom, myRole: 'member' }
    const { result } = await renderObserved()
    const before = reads(ROOM)

    await act(async () => {
      await result.current.startDate.start().catch(() => undefined)
    })
    await waitFor(() => expect(reads(ROOM)).toBeGreaterThan(before))
    expect(mockPatch).toHaveBeenCalledTimes(1)
  })
})

describe('stop writes on a room that is not active', () => {
  const notActive = new ApiError(409, { code: 'ROOM_NOT_ACTIVE', message: 'Stops complete during the active date' })

  function useStopWrites() {
    return {
      room: useRoom('room-1'),
      plan: usePlan('plan-1'),
      complete: useCompletePlanStop('plan-1'),
      checkin: useCheckinPlanStop('plan-1'),
    }
  }

  async function renderStopWrites() {
    const rendered = await renderHook(useStopWrites, { wrapper })
    await waitFor(() => expect(rendered.result.current.room.isSuccess && rendered.result.current.plan.isSuccess).toBe(true))
    return rendered
  }

  it('reads the room again when completing a stop is refused', async () => {
    mockPost.mockRejectedValue(notActive)
    const { result } = await renderStopWrites()
    const before = reads(ROOM)

    await act(async () => {
      await result.current.complete.mutateAsync('stop-1').catch(() => undefined)
    })
    await waitFor(() => expect(reads(ROOM)).toBeGreaterThan(before))
  })

  it('reads the room again when a check-in is refused', async () => {
    mockPost.mockRejectedValue(notActive)
    const { result } = await renderStopWrites()
    const before = reads(ROOM)

    await act(async () => {
      await result.current.checkin.mutateAsync({ stopId: 'stop-1', tags: [], photoKeys: [] }).catch(() => undefined)
    })
    await waitFor(() => expect(reads(ROOM)).toBeGreaterThan(before))
  })

  it('leaves the room alone for an unrelated failure', async () => {
    mockPost.mockRejectedValue(new NetworkError())
    const { result } = await renderStopWrites()
    const before = reads(ROOM)

    await act(async () => {
      await result.current.complete.mutateAsync('stop-1').catch(() => undefined)
    })
    await waitFor(() => expect(result.current.complete.isError).toBe(true))
    expect(reads(ROOM)).toBe(before)
  })
})
