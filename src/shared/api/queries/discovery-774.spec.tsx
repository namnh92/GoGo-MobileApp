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

/** Fetch boundary: exercise HTTP status/envelope decoding, not a thrown ApiError. */
function response(body: unknown, status = 200): Response {
  return { ok: status < 400, status, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body, text: async () => JSON.stringify(body) } as Response
}

it.each(['search', 'preview'] as const)('decodes HTTP 429 count-unavailable and preserves every %s request parameter on fallback', async kind => {
  const page = { results: [], nextCursor: 'next', meta: {} }
  const fetch = jest.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(response({ code: 'SEARCH_COUNT_UNAVAILABLE', message: 'Count quota exceeded' }, 429))
    .mockResolvedValueOnce(response(page))
    .mockResolvedValueOnce(response({ ...page, nextCursor: null }))
  const query = { lat: 10, lng: 106, radiusM: 3000, q: 'cà phê', moods: 'cozy', amenities: 'wifi', categories: 'cafe', locale: 'vi' as const, sort: 'curated' as const, includeTotal: true, limit: 5 }
  const { wrapper } = harness()
  const hook = await renderHook(() => kind === 'search' ? usePlaceSearch(query) : useDiscoveryPreview(query, true), { wrapper })
  await settleQueries()
  expect(hook.result.current.isSuccess).toBe(true)
  const urls = fetch.mock.calls.map(([url]) => new URL(String(url)))
  expect(urls[0].searchParams.get('includeTotal')).toBe('true')
  expect(urls[1].searchParams.has('includeTotal')).toBe(false)
  urls[0].searchParams.delete('includeTotal')
  expect(urls[1].origin + urls[1].pathname).toBe(urls[0].origin + urls[0].pathname)
  expect([...urls[1].searchParams]).toEqual([...urls[0].searchParams])
  expect(Object.fromEntries(urls[1].searchParams)).toMatchObject({ lat: '10', lng: '106', q: 'cà phê', moods: 'cozy', amenities: 'wifi', categories: 'cafe', locale: 'vi', sort: 'curated', limit: kind === 'preview' ? '1' : '5' })
  if ('fetchNextPage' in hook.result.current) {
    const fetchNextPage = hook.result.current.fetchNextPage
    await act(async () => { await fetchNextPage() })
    await settleQueries()
    const next = new URL(String(fetch.mock.calls[2][0]))
    expect(next.searchParams.get('cursor')).toBe('next')
    expect(next.searchParams.has('includeTotal')).toBe(false)
    next.searchParams.delete('cursor')
    expect([...next.searchParams]).toEqual([...urls[1].searchParams])
  }
})

it.each(['search', 'preview'] as const)('does not retry generic HTTP RATE_LIMITED without totals (%s)', async kind => {
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue(response({ code: 'RATE_LIMITED', message: 'Too many requests' }, 429))
  const { wrapper } = harness()
  const hook = await renderHook(() => kind === 'search' ? usePlaceSearch({ q: 'tea', includeTotal: true }) : useDiscoveryPreview({ q: 'tea' }, true), { wrapper })
  await settleQueries()
  expect(hook.result.current.error).toMatchObject({ status: 429, code: 'RATE_LIMITED' })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(new URL(String(fetch.mock.calls[0][0])).searchParams.get('includeTotal')).toBe('true')
})
