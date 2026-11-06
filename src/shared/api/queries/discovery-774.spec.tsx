import { act, renderHook, waitFor } from '@testing-library/react-native'
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import * as places from '../endpoints/places'
import * as rooms from '../endpoints/rooms'
import * as assistant from '../endpoints/assistant'
import { ApiError } from '../errors'
import { queryKeys } from '../query-keys'
import { useContributionCredits, useDiscoveryPreview, usePlaceSearch, usePlaceSubmission } from './use-places'
import { useHomeRoom } from './use-rooms'

let client: QueryClient
function harness() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return { client, wrapper }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(yes => { resolve = yes })
  return { promise, resolve }
}
// GoGo-MobileApp#133: like the other query specs, flush observer notifications
// in the act that settles the request instead of leaving a notifyManager timer.
beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))
afterEach(() => {
  client.clear()
  jest.restoreAllMocks()
})

async function settleQueries() {
  await waitFor(() => expect(client.isFetching()).toBe(0))
}

it('ignores an older preview arriving after scope/query/draft changed', async () => {
  const old = deferred<Awaited<ReturnType<typeof places.searchPlaces>>>()
  const fresh = deferred<Awaited<ReturnType<typeof places.searchPlaces>>>()
  const request = jest.spyOn(places, 'searchPlaces').mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise)
  const { wrapper } = harness()
  const hook = await renderHook(({ lat, q, amenities }: { lat: number; q: string; amenities: string }) => useDiscoveryPreview({ lat, lng: 106, q, amenities }, true), { wrapper, initialProps: { lat: 10, q: 'tea', amenities: 'wifi' } })
  await hook.rerender({ lat: 21, q: 'coffee', amenities: 'wifi,power_outlets' })
  await act(async () => {
    fresh.resolve({ results: [], nextCursor: null, meta: { totalCount: 2 } })
    await fresh.promise
  })
  expect(hook.result.current.data?.meta?.totalCount).toBe(2)
  await act(async () => {
    old.resolve({ results: [], nextCursor: null, meta: { totalCount: 99 } })
    await old.promise
  })
  await settleQueries()
  expect(hook.result.current.data?.meta?.totalCount).toBe(2)
  expect(request).toHaveBeenLastCalledWith({ lat: 21, lng: 106, q: 'coffee', amenities: 'wifi,power_outlets', includeTotal: true, limit: 1 })
})
it('retries a count outage without totals and paginates without recounting', async () => {
  const request = jest.spyOn(places, 'searchPlaces')
    .mockRejectedValueOnce(new ApiError(503, { code: 'SEARCH_COUNT_UNAVAILABLE', message: 'unavailable' }))
    .mockResolvedValueOnce({ results: [], nextCursor: 'next', meta: {} })
    .mockResolvedValueOnce({ results: [], nextCursor: null, meta: {} })
  const { wrapper } = harness()
  const hook = await renderHook(() => usePlaceSearch({ q: 'tea', includeTotal: true }), { wrapper })
  await settleQueries()
  expect(hook.result.current.isSuccess).toBe(true)
  expect(hook.result.current.data?.pages[0]?.meta?.totalCount).toBeUndefined()
  expect(request.mock.calls[1]?.[0].includeTotal).toBeUndefined()
  await act(async () => {
    await hook.result.current.fetchNextPage()
  })
  await settleQueries()
  expect(request).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'next', includeTotal: undefined }))
})
it('requests the authoritative Home selection without activity/status/cursor sorting', async () => {
  const request = jest.spyOn(rooms, 'listRooms').mockResolvedValue({ items: [], nextCursor: null })
  const { wrapper } = harness()
  const hook = await renderHook(() => useHomeRoom(true), { wrapper })
  await settleQueries()
  expect(hook.result.current.isSuccess).toBe(true)
  expect(request).toHaveBeenCalledWith({ view: 'home', limit: 1 })
})
it('refetches server balances after an approved submission, without adding credits locally', async () => {
  jest.spyOn(places, 'getPlaceSubmission').mockResolvedValue({ id: 's', status: 'approved' })
  const read = jest.spyOn(assistant, 'getAssistantStatus').mockResolvedValue({ creditBalance: 13, state: 'enabled', remainingToday: 0, dailyMessageLimit: 30, resetsAt: '2026-11-06T17:00:00Z' })
  const { client, wrapper } = harness()
  client.setQueryData(queryKeys.assistantStatus(), { creditBalance: 4 })
  const hook = await renderHook(() => useContributionCredits(true), { wrapper })
  await settleQueries()
  expect(hook.result.current.data?.creditBalance).toBe(13)
  read.mockResolvedValue({ creditBalance: 21, state: 'enabled', remainingToday: 0, dailyMessageLimit: 30, resetsAt: '2026-11-06T17:00:00Z' })
  const submission = await renderHook(() => usePlaceSubmission('s'), { wrapper })
  await settleQueries()
  expect(submission.result.current.isSuccess).toBe(true)
  expect(hook.result.current.data?.creditBalance).toBe(21)
  expect(client.getQueryData(queryKeys.assistantStatus())).toEqual({ creditBalance: 4 })
  expect(client.getQueryState(queryKeys.assistantStatus())?.isInvalidated).toBe(true)
})
