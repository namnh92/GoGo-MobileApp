import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'

/**
 * APP-006's acceptance is "optimistic action rollback đúng". Three mutations
 * write to the cache before the server answers — voting, locking a stop and
 * saving a place — and each is supposed to put the old value back when the call
 * fails. That was implemented and never tested, so a rollback could rot
 * silently: the user would see their vote stick after a failed request and only
 * find out on the next refetch.
 *
 * Each case asserts both halves: the optimistic value lands immediately, and a
 * rejection restores exactly what was there before.
 */

const mockCastVote = jest.fn()
const mockLockStop = jest.fn()
const mockSaveItem = jest.fn()
const mockUnsaveItem = jest.fn()

jest.mock('@/shared/api/endpoints/suggestions', () => ({
  ...jest.requireActual('@/shared/api/endpoints/suggestions'),
  castVote: (...args: unknown[]) => mockCastVote(...args),
}))

jest.mock('@/shared/api/endpoints/plans', () => ({
  ...jest.requireActual('@/shared/api/endpoints/plans'),
  lockPlanStop: (...args: unknown[]) => mockLockStop(...args),
}))

jest.mock('@/shared/api/endpoints/me', () => ({
  ...jest.requireActual('@/shared/api/endpoints/me'),
  saveItem: (...args: unknown[]) => mockSaveItem(...args),
  unsaveItem: (...args: unknown[]) => mockUnsaveItem(...args),
}))

import { queryKeys } from '@/shared/api/query-keys'
import { useCastVote } from '@/shared/api/queries/use-suggestions'
import { useLockPlanStop } from '@/shared/api/queries/use-plans'
import { useToggleSaved } from '@/shared/api/queries/use-me'

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

beforeEach(() => {
  // Retries would mask a rollback: the cache would be restored and re-applied
  // several times before the test looked at it.
  queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  jest.clearAllMocks()
})

describe('voting', () => {
  const roomId = 'room-1'
  const key = queryKeys.roomSuggestions(roomId)
  const before = {
    candidates: [
      { placeId: 'place-1', myVote: null },
      { placeId: 'place-2', myVote: 'yes' },
    ],
    votes: { mine: { 'place-2': 'yes' } },
  }

  it('shows the vote before the server answers', async () => {
    let resolve: (value: unknown) => void = () => {}
    mockCastVote.mockReturnValue(new Promise(r => (resolve = r)))
    queryClient.setQueryData(key, before)

    const { result } = await renderHook(() => useCastVote(roomId), { wrapper })
    result.current.mutate({ placeId: 'place-1', value: 'yes' })

    await waitFor(() => {
      const now = queryClient.getQueryData<typeof before>(key)
      expect(now?.candidates[0].myVote).toBe('yes')
    })
    resolve({ matched: false })
  })

  it('puts the old vote back when the call fails', async () => {
    mockCastVote.mockRejectedValue(new Error('offline'))
    queryClient.setQueryData(key, before)

    const { result } = await renderHook(() => useCastVote(roomId), { wrapper })
    result.current.mutate({ placeId: 'place-1', value: 'yes' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(queryClient.getQueryData(key)).toEqual(before)
  })

  it('does not invent a cache entry when there was nothing to roll back to', async () => {
    mockCastVote.mockRejectedValue(new Error('offline'))

    const { result } = await renderHook(() => useCastVote(roomId), { wrapper })
    result.current.mutate({ placeId: 'place-1', value: 'yes' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(queryClient.getQueryData(key)).toBeUndefined()
  })
})

describe('locking a stop', () => {
  const planId = 'plan-1'
  const key = queryKeys.plan(planId)
  const before = {
    id: planId,
    stops: [
      { id: 'stop-1', isLocked: false },
      { id: 'stop-2', isLocked: true },
    ],
  }

  it('shows the lock before the server answers', async () => {
    let resolve: (value: unknown) => void = () => {}
    mockLockStop.mockReturnValue(new Promise(r => (resolve = r)))
    queryClient.setQueryData(key, before)

    const { result } = await renderHook(() => useLockPlanStop(planId), { wrapper })
    result.current.mutate({ stopId: 'stop-1', locked: true })

    await waitFor(() => {
      const now = queryClient.getQueryData<typeof before>(key)
      expect(now?.stops[0].isLocked).toBe(true)
    })
    resolve(before)
  })

  it('unlocks again when the call fails, leaving the other stop alone', async () => {
    mockLockStop.mockRejectedValue(new Error('offline'))
    queryClient.setQueryData(key, before)

    const { result } = await renderHook(() => useLockPlanStop(planId), { wrapper })
    result.current.mutate({ stopId: 'stop-1', locked: true })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(queryClient.getQueryData(key)).toEqual(before)
  })
})

describe('saving a place', () => {
  const key = queryKeys.saved()
  const before = [{ targetType: 'place', targetId: 'place-9', savedAt: '2026-08-01T00:00:00.000Z' }]

  it('adds the place before the server answers', async () => {
    let resolve: (value: unknown) => void = () => {}
    mockSaveItem.mockReturnValue(new Promise(r => (resolve = r)))
    queryClient.setQueryData(key, before)

    const { result } = await renderHook(() => useToggleSaved(), { wrapper })
    result.current.mutate({ type: 'place', id: 'place-1', saved: false })

    await waitFor(() => {
      expect(queryClient.getQueryData<typeof before>(key)).toHaveLength(2)
    })
    resolve(undefined)
  })

  it('removes it again when the call fails', async () => {
    mockSaveItem.mockRejectedValue(new Error('offline'))
    queryClient.setQueryData(key, before)

    const { result } = await renderHook(() => useToggleSaved(), { wrapper })
    result.current.mutate({ type: 'place', id: 'place-1', saved: false })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(queryClient.getQueryData(key)).toEqual(before)
  })

  it('puts a removed place back when unsaving fails', async () => {
    mockUnsaveItem.mockRejectedValue(new Error('offline'))
    queryClient.setQueryData(key, before)

    const { result } = await renderHook(() => useToggleSaved(), { wrapper })
    result.current.mutate({ type: 'place', id: 'place-9', saved: true })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(queryClient.getQueryData(key)).toEqual(before)
  })
})
