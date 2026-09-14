import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react-native'

/**
 * APP-060 (#219) — the helpful toggle writes to the cache before the server
 * answers. These pin both halves: the optimistic count lands in every cached
 * order at once, and a rejection restores exactly what was there; a success
 * takes the server's count; a mark on an already-marked review counts nothing.
 */

const mockMark = jest.fn()
const mockUnmark = jest.fn()

jest.mock('@/shared/api/endpoints/me', () => ({
  ...jest.requireActual('@/shared/api/endpoints/me'),
  markReviewHelpful: (...args: unknown[]) => mockMark(...args),
  unmarkReviewHelpful: (...args: unknown[]) => mockUnmark(...args),
}))

import { queryKeys } from '@/shared/api/query-keys'
import { useToggleReviewHelpful } from '@/shared/api/queries/use-me'

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const placeId = 'place-1'
const latestKey = queryKeys.placeReviews(placeId, 'latest')
const helpfulKey = queryKeys.placeReviews(placeId, 'helpful')
const mineKey = queryKeys.myReviewReactions(placeId)

const review = (id: string, helpfulCount: number) => ({
  id,
  rating: 5,
  createdAt: '2026-09-14T05:00:00.000Z',
  author: { displayName: 'Lan' },
  helpfulCount,
})
type Preview = { reviews: ReturnType<typeof review>[] }

const countIn = (key: readonly unknown[]) => queryClient.getQueryData<Preview>(key)?.reviews[0]?.helpfulCount
const myMarks = () => queryClient.getQueryData<{ helpful: string[] }>(mineKey)?.helpful

function deferred() {
  let resolve: (value: unknown) => void = () => {}
  let reject: (error: unknown) => void = () => {}
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  // Retries would mask a rollback: restored and re-applied before the assertion.
  queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity }, queries: { retry: false, gcTime: Infinity } },
  })
  jest.clearAllMocks()
  queryClient.setQueryData(latestKey, { source: 'gogo', order: 'latest', reviews: [review('r1', 2)] })
  queryClient.setQueryData(helpfulKey, { source: 'gogo', order: 'helpful', reviews: [review('r1', 2)] })
  queryClient.setQueryData(mineKey, { placeId, helpful: [] })
})

afterEach(() => {
  queryClient.clear()
})

it('moves the count in both orders before the server answers, and puts it back when the mark fails', async () => {
  const call = deferred()
  mockMark.mockReturnValue(call.promise)
  const { result } = await renderHook(() => useToggleReviewHelpful(placeId), { wrapper })

  result.current.mutate({ reviewId: 'r1', helpful: true })
  await waitFor(() => expect(countIn(latestKey)).toBe(3))
  expect(countIn(helpfulKey)).toBe(3)
  expect(myMarks()).toEqual(['r1'])

  call.reject(new Error('offline'))
  await waitFor(() => expect(countIn(latestKey)).toBe(2))
  expect(countIn(helpfulKey)).toBe(2)
  expect(myMarks()).toEqual([])
})

it("settles on the server's count", async () => {
  mockMark.mockResolvedValue({ reviewId: 'r1', helpfulCount: 9, reactedByMe: true })
  const { result } = await renderHook(() => useToggleReviewHelpful(placeId), { wrapper })

  result.current.mutate({ reviewId: 'r1', helpful: true })

  await waitFor(() => expect(countIn(latestKey)).toBe(9))
  expect(countIn(helpfulKey)).toBe(9)
  expect(myMarks()).toEqual(['r1'])
})

it('counts nothing when a retry marks a review that is already marked', async () => {
  queryClient.setQueryData(mineKey, { placeId, helpful: ['r1'] })
  const call = deferred()
  mockMark.mockReturnValue(call.promise)
  const { result } = await renderHook(() => useToggleReviewHelpful(placeId), { wrapper })

  result.current.mutate({ reviewId: 'r1', helpful: true })
  await waitFor(() => expect(mockMark).toHaveBeenCalledTimes(1))
  expect(countIn(latestKey)).toBe(2)

  call.resolve({ reviewId: 'r1', helpfulCount: 2, reactedByMe: true })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(countIn(latestKey)).toBe(2)
  expect(myMarks()).toEqual(['r1'])
})

it('removes a mark optimistically and restores it when removal fails', async () => {
  queryClient.setQueryData(mineKey, { placeId, helpful: ['r1'] })
  const call = deferred()
  mockUnmark.mockReturnValue(call.promise)
  const { result } = await renderHook(() => useToggleReviewHelpful(placeId), { wrapper })

  result.current.mutate({ reviewId: 'r1', helpful: false })
  await waitFor(() => expect(countIn(latestKey)).toBe(1))
  expect(myMarks()).toEqual([])

  call.reject(new Error('boom'))
  await waitFor(() => expect(myMarks()).toEqual(['r1']))
  expect(countIn(latestKey)).toBe(2)
})
