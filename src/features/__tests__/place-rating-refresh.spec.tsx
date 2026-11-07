import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native'

import { loaded as mockLoaded, renderScreen } from './harness'
import { queryKeys } from '@/shared/api/query-keys'
import type { PlaceDetail, PlaceReviewPreview } from '@/shared/api/types'

const mockDetail = jest.fn()
const mockReviews = jest.fn()
jest.mock('@/shared/api/endpoints/places', () => ({
  ...jest.requireActual('@/shared/api/endpoints/places'),
  getPlaceDetail: (...args: unknown[]) => mockDetail(...args),
  listPlaceReviews: (...args: unknown[]) => mockReviews(...args),
}))
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ placeId: 'p' }),
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'guest' }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlaceProviderPhotos: () => ({ data: undefined }),
  useMyReviewReactions: () => mockLoaded({ placeId: 'p', helpful: [] }),
  useToggleReviewHelpful: () => ({ mutate: jest.fn(), isPending: false }),
  useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: jest.fn() }),
  useTaxonomyLabel: () => ({ resolve: (_kind: string, key: string) => key }),
}))

import PlaceDetailScreen from '@/features/date-plan/place-detail.view'

const detail: PlaceDetail = { id: 'p', name: 'Quán thử', gogoRatingCount: 8, gogoRating: 4.8, checkedInGroupCount: 0 }
const page = (count: number, rating?: number): PlaceReviewPreview => ({
  source: 'gogo', order: 'latest', gogoRatingCount: count, gogoRating: rating,
  reviews: [], items: [{ id: 'r', rating: 5, helpfulCount: 0, author: { displayName: 'Lan' }, createdAt: '2026-11-07T00:00:00Z' }],
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

let client: QueryClient
beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))
beforeEach(() => {
  mockDetail.mockReset()
  mockReviews.mockReset()
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  mockDetail.mockResolvedValue(detail)
  mockReviews.mockResolvedValue(page(8, 4.8))
})
afterEach(() => client.clear())

async function openDetail() {
  await renderScreen(<QueryClientProvider client={client}><PlaceDetailScreen /></QueryClientProvider>)
  await waitFor(() => expect(screen.getByText('Đánh giá gần nhất trên GoGo (8)')).toBeTruthy())
}

it.each(['detail-last', 'reviews-last'] as const)('keeps header and reviews on the moderated first-page aggregate (%s)', async responseOrder => {
  await openDetail()
  const oldDetail = deferred<PlaceDetail>()
  const moderated = deferred<PlaceReviewPreview>()
  mockDetail.mockReturnValueOnce(oldDetail.promise)
  mockReviews.mockReturnValueOnce(moderated.promise)
  let refresh!: Promise<void>
  await act(async () => { refresh = client.invalidateQueries() })
  expect(mockDetail).toHaveBeenCalledTimes(2)
  expect(mockReviews).toHaveBeenCalledTimes(2)

  if (responseOrder === 'detail-last') {
    await act(async () => { moderated.resolve(page(3)) })
    await act(async () => { oldDetail.resolve(detail); await refresh })
  } else {
    await act(async () => { oldDetail.resolve(detail) })
    await act(async () => { moderated.resolve(page(3)); await refresh })
  }
  expect(screen.getByText('Đánh giá gần nhất trên GoGo (3)')).toBeTruthy()
  const header = within(screen.getByTestId('place-detail-facts'))
  expect(header.queryByText(/^★ 4,8.*GoGo$/)).toBeNull()
  expect(header.getByText('GoGo · 3 đánh giá · Chưa đủ 5 đánh giá')).toBeTruthy()
  // Reviews must not mutate the independent detail cache.
  expect(client.getQueryData(queryKeys.place('p'))).toEqual(detail)
})

it('uses the selected order first page, including zero, and ignores later-page aggregates', async () => {
  await openDetail()
  mockReviews.mockResolvedValueOnce({ ...page(6, 4.1), order: 'helpful', nextCursor: 'next' })
  await fireEvent.press(screen.getByLabelText('Hữu ích nhất'))
  await waitFor(() => expect(screen.getByText('Đánh giá gần nhất trên GoGo (6)')).toBeTruthy())
  expect(within(screen.getByTestId('place-detail-facts')).getByText(/^★ 4,1.*GoGo$/)).toBeTruthy()
  mockReviews.mockResolvedValueOnce({ ...page(99, 5), order: 'helpful' })
  await fireEvent.press(screen.getByText('Xem thêm'))
  await waitFor(() => expect(mockReviews).toHaveBeenLastCalledWith('p', 'helpful', { limit: 10, cursor: 'next' }))
  expect(within(screen.getByTestId('place-detail-facts')).getByText(/^★ 4,1.*GoGo$/)).toBeTruthy()
  mockReviews.mockResolvedValueOnce({ ...page(0), order: 'helpful', items: [] })
  await act(async () => { await client.invalidateQueries({ queryKey: queryKeys.placeReviews('p', 'helpful') }) })
  expect(screen.getByText('Đánh giá gần nhất trên GoGo (0)')).toBeTruthy()
  expect(within(screen.getByTestId('place-detail-facts')).queryByText(/^★/)).toBeNull()
})
