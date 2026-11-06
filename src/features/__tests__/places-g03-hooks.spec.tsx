import type { ReactNode } from 'react'
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'

const mockReviews = jest.fn()
const mockPhotos = jest.fn()
const mockReport = jest.fn()
jest.mock('@/shared/api/endpoints/places', () => ({
  ...jest.requireActual('@/shared/api/endpoints/places'),
  listPlaceReviews: (...args: unknown[]) => mockReviews(...args),
  getPlaceProviderPhotos: (...args: unknown[]) => mockPhotos(...args),
  reportPlace: (...args: unknown[]) => mockReport(...args),
}))

import { usePlaceProviderPhotos, usePlaceReviews, useReportPlace } from '@/shared/api/queries/use-places'
import { queryKeys } from '@/shared/api/query-keys'
import type { PlaceDetail } from '@/shared/api/types'

beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))

let client: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
beforeEach(() => {
  jest.resetAllMocks()
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })
})
afterEach(() => client.clear())

it('sends limit/cursor, keeps every page and resets the cursor on order change', async () => {
  const row = (id: string) => ({ id, rating: 5, helpfulCount: 0, author: { displayName: 'Lan' }, createdAt: '2026-11-07T00:00:00Z' })
  mockReviews.mockImplementation((_id, order, page) => Promise.resolve({
    order, source: 'gogo', reviews: [], items: [row(page.cursor ? 'second' : 'first')], nextCursor: page.cursor ? null : 'next', gogoRatingCount: 7, gogoRating: 4.2,
  }))
  client.setQueryData(queryKeys.place('p'), { id: 'p', gogoRatingCount: 8, gogoRating: 4.8 })
  const { result, rerender } = await renderHook(({ order }: { order: 'latest' | 'helpful' }) => ({ ...usePlaceReviews('p', order) }), { wrapper, initialProps: { order: 'latest' } })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(mockReviews).toHaveBeenCalledWith('p', 'latest', { limit: 10, cursor: undefined })
  await act(async () => { await result.current.fetchNextPage() })
  expect(mockReviews).toHaveBeenLastCalledWith('p', 'latest', { limit: 10, cursor: 'next' })
  await waitFor(() => expect(result.current.data?.pages.flatMap(page => page.items?.map(item => item.id))).toEqual(['first', 'second']))
  expect(result.current.hasNextPage).toBe(false)
  expect(client.getQueryData<PlaceDetail>(queryKeys.place('p'))).toMatchObject({ gogoRatingCount: 8, gogoRating: 4.8 })
  await rerender({ order: 'helpful' })
  await waitFor(() => expect(mockReviews).toHaveBeenLastCalledWith('p', 'helpful', { limit: 10, cursor: undefined }))
})

it('fetches provider bytes once per detail view and drops them when unmounted', async () => {
  mockPhotos.mockResolvedValue({ status: 'budget_exhausted', provider: 'google', attribution: 'Google Maps', photos: [] })
  const { result, unmount } = await renderHook(() => usePlaceProviderPhotos('p'), { wrapper })
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  expect(mockPhotos).toHaveBeenCalledTimes(1)
  await unmount()
  await waitFor(() => expect(client.getQueryData(['place-provider-photos', 'p'])).toBeUndefined())
})

it('replays one report intent key on a retry', async () => {
  client.setDefaultOptions({ mutations: { retry: 1, retryDelay: 0, gcTime: Infinity } })
  mockReport.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ id: 'report' })
  const { result } = await renderHook(() => useReportPlace('p'), { wrapper })
  await act(async () => { await result.current.mutateAsync({ reasonCode: 'wrong_hours', note: 'Hours changed' }) })
  expect(mockReport).toHaveBeenCalledTimes(2)
  expect(mockReport.mock.calls[0][2]).toBe(mockReport.mock.calls[1][2])
  expect(mockReport.mock.calls[0][2]).toEqual(expect.any(String))
})
