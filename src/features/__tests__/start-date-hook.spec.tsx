import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'

/**
 * #251 — "Bắt đầu đi" never moved the room to `active`, so every stop
 * completion and check-in answered 409 ROOM_NOT_ACTIVE. These pin the hook that
 * now performs the transition: exactly one PATCH per press, an already-active
 * room counts as started, and the caches that depend on room status refresh.
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
import { queryKeys } from '@/shared/api/query-keys'
import { useCheckinPlanStop, useCompletePlanStop, usePlan } from '@/shared/api/queries/use-plans'
import { useRoom, useStartDate } from '@/shared/api/queries/use-rooms'

let client: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const readyRoom = { id: 'room-1', status: 'ready', myRole: 'host' }
const activeRoom = { id: 'room-1', status: 'active', myRole: 'host' }
const plan = { id: 'plan-1', roomId: 'room-1', stops: [] }
const invalidTransition = new ApiError(409, {
  code: 'INVALID_ROOM_TRANSITION',
  message: 'Cannot move room from active to active',
})

/** GET by path, so the room and the plan each answer with their own shape. */
function serve(room: unknown) {
  mockGet.mockImplementation(async (path: string) => (path.startsWith('/plans/') ? plan : room))
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity }, queries: { retry: false, gcTime: Infinity } },
  })
  jest.clearAllMocks()
  // clearAllMocks keeps queued once-answers; a test that stops early must not
  // hand its leftovers to the next one.
  for (const mock of [mockPatch, mockGet, mockPost]) mock.mockReset()
  serve(readyRoom)
})
afterEach(() => client.clear())

describe('useStartDate', () => {
  it('moves the room to active and refetches the room, its plan and the Plans tabs', async () => {
    mockPatch.mockResolvedValue(activeRoom)
    const invalidate = jest.spyOn(client, 'invalidateQueries')
    // Screens observe the room and the plan; a refetch is what they see.
    const { result } = await renderHook(
      () => ({ room: useRoom('room-1'), plan: usePlan('plan-1'), startDate: useStartDate('room-1', 'plan-1') }),
      { wrapper },
    )
    await waitFor(() => {
      expect(result.current.room.isSuccess).toBe(true)
      expect(result.current.plan.isSuccess).toBe(true)
    })
    const roomReads = () => mockGet.mock.calls.filter(([path]) => path === '/rooms/{id}').length
    const planReads = () => mockGet.mock.calls.filter(([path]) => path === '/plans/{id}').length
    const [roomBefore, planBefore] = [roomReads(), planReads()]
    serve(activeRoom)

    let started: unknown
    await act(async () => {
      started = await result.current.startDate.start()
    })

    expect(started).toEqual(activeRoom)
    expect(mockPatch).toHaveBeenCalledTimes(1)
    expect(mockPatch).toHaveBeenCalledWith('/rooms/{id}/status', { status: 'active' }, { pathParams: { id: 'room-1' } })
    expect(client.getQueryData(queryKeys.room('room-1'))).toEqual(activeRoom)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.room('room-1'), exact: true })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.roomCurrentPlan('room-1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.plan('plan-1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['rooms', 'list'] })
    await waitFor(() => {
      expect(roomReads()).toBeGreaterThan(roomBefore)
      expect(planReads()).toBeGreaterThan(planBefore)
      expect(result.current.room.isFetching).toBe(false)
      expect(result.current.plan.isFetching).toBe(false)
    })
  })

  it('sends one request when start is called twice before the first answers', async () => {
    const answer = deferred<unknown>()
    mockPatch.mockReturnValue(answer.promise)
    const { result } = await renderHook(() => useStartDate('room-1', 'plan-1'), { wrapper })

    let first: Promise<unknown> | undefined
    let second: Promise<unknown> | undefined
    await act(async () => {
      first = result.current.start()
      second = result.current.start()
    })
    expect(mockPatch).toHaveBeenCalledTimes(1)
    // The joined tap does nothing, so its caller must not navigate either.
    await expect(second).resolves.toBeNull()

    await act(async () => {
      answer.resolve(activeRoom)
      await first
    })
    await expect(first).resolves.toEqual(activeRoom)
    expect(mockPatch).toHaveBeenCalledTimes(1)
  })

  it('reports a failure and lets the next press retry', async () => {
    mockPatch.mockRejectedValueOnce(new NetworkError()).mockResolvedValueOnce(activeRoom)
    const { result } = await renderHook(() => useStartDate('room-1', 'plan-1'), { wrapper })

    await act(async () => {
      await result.current.start().catch(() => undefined)
    })
    await waitFor(() => expect(result.current.isError).toBe(true))

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
    serve(activeRoom)
    const { result } = await renderHook(() => useStartDate('room-1', 'plan-1'), { wrapper })

    let started: unknown
    await act(async () => {
      started = await result.current.start()
    })
    expect(started).toEqual(activeRoom)
    expect(mockGet).toHaveBeenCalledWith('/rooms/{id}', { pathParams: { id: 'room-1' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(client.getQueryData(queryKeys.room('room-1'))).toEqual(activeRoom)
  })

  it('rethrows a 409 when the room is not active, and refetches the room', async () => {
    mockPatch.mockRejectedValue(invalidTransition)
    serve({ ...readyRoom, status: 'matching' })
    const invalidate = jest.spyOn(client, 'invalidateQueries')
    const { result } = await renderHook(() => useStartDate('room-1', 'plan-1'), { wrapper })

    let caught: unknown
    await act(async () => {
      caught = await result.current.start().catch((error: unknown) => error)
    })
    expect(caught).toBe(invalidTransition)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.room('room-1'), exact: true })
  })

  it('refetches the room when a member is refused as not the host', async () => {
    mockPatch.mockRejectedValue(new ApiError(403, { code: 'HOST_ONLY', message: 'Only the host' }))
    const invalidate = jest.spyOn(client, 'invalidateQueries')
    const { result } = await renderHook(() => useStartDate('room-1', 'plan-1'), { wrapper })

    await act(async () => {
      await result.current.start().catch(() => undefined)
    })
    expect(mockGet).not.toHaveBeenCalledWith('/rooms/{id}', expect.anything())
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.room('room-1'), exact: true })
  })
})

describe('stop writes on a room that is not active', () => {
  const notActive = new ApiError(409, { code: 'ROOM_NOT_ACTIVE', message: 'Stops complete during the active date' })

  it('refetches the room when completing a stop is refused', async () => {
    client.setQueryData(queryKeys.plan('plan-1'), plan)
    mockPost.mockRejectedValue(notActive)
    const invalidate = jest.spyOn(client, 'invalidateQueries')
    const { result } = await renderHook(() => useCompletePlanStop('plan-1'), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('stop-1').catch(() => undefined)
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.room('room-1'), exact: true })
  })

  it('refetches the room when a check-in is refused', async () => {
    client.setQueryData(queryKeys.plan('plan-1'), plan)
    mockPost.mockRejectedValue(notActive)
    const invalidate = jest.spyOn(client, 'invalidateQueries')
    const { result } = await renderHook(() => useCheckinPlanStop('plan-1'), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ stopId: 'stop-1', tags: [], photoKeys: [] }).catch(() => undefined)
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.room('room-1'), exact: true })
  })

  it('leaves the room alone for an unrelated failure', async () => {
    client.setQueryData(queryKeys.plan('plan-1'), plan)
    mockPost.mockRejectedValue(new NetworkError())
    const invalidate = jest.spyOn(client, 'invalidateQueries')
    const { result } = await renderHook(() => useCompletePlanStop('plan-1'), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('stop-1').catch(() => undefined)
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(invalidate).not.toHaveBeenCalled()
  })
})
