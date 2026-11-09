import { act, cleanup, fireEvent, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import type { OpResponse } from '@/shared/api/types'
import { themes } from '@/shared/ui/theme'
import fixture from '../../../test/fixtures/my-reviews-full-case.json'
import { renderScreen } from './harness'

const mockRouter = { back: jest.fn(), push: jest.fn() }
const mockRefresh = jest.fn()
let mockReviews: any
let mockOnline = true
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ tab: 'reviews' }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => mockOnline, currentOfflineSpell: () => 1 }))
jest.mock('@/shared/api/queries/use-my-place-submissions', () => ({ useMyPlaceSubmission: () => ({}), useMyPlaceSubmissions: () => ({ data: { pages: [{ items: [] }] } }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMyReviews: () => mockReviews,
  usePlaceDetail: () => ({ data: undefined }),
}))
const reviews = fixture as OpResponse<'listMyReviews'>
export function contributionReviewTests(theme: 'orange' | 'orangeDark') {
  // Load styles after selecting the palette: the native-free mock resolves create() once.
  UnistylesSheet.configure({ themes: { [theme]: themes[theme] } as typeof themes })
  const MyContributionsScreen = jest.requireActual<typeof import('../contributions/my-contributions.view')>('../contributions/my-contributions.view').default
  const { ContributionReviewCard } = jest.requireActual<typeof import('@/shared/ui/contribution-review-card.view')>('@/shared/ui/contribution-review-card.view')
beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockOnline = true
  mockReviews = { data: reviews, refetch: mockRefresh, isPending: false, isError: false }
})
afterEach(async () => {
  await cleanup()
  jest.clearAllTimers()
  jest.useRealTimers()
  UnistylesSheet.configure({ themes })
})

it('keeps the proxy fixture within the review-list contract, including every moderation status', () => {
  const fields: Record<keyof OpResponse<'listMyReviews'>[number], true> = {
    id: true, placeId: true, planId: true, rating: true, text: true, status: true, createdAt: true,
    placeName: true, placeAddressText: true, planTitle: true, planScheduledDate: true, helpfulCount: true, rejectionReason: true,
  }
  expect(reviews.map(row => row.status)).toEqual(['published', 'pending', 'rejected', 'removed'])
  for (const row of reviews) {
    expect(Object.keys(row).every(key => key in fields)).toBe(true)
    expect(row.rating).toBeGreaterThanOrEqual(1)
    expect(row.rating).toBeLessThanOrEqual(5)
    expect(Number.isFinite(Date.parse(row.createdAt!))).toBe(true)
    expect(row.helpfulCount).toBeGreaterThanOrEqual(0)
  }
  expect(reviews[0].text!.length).toBeGreaterThan(400)
  // /me/reviews has no attachment field: never mislabel catalogue images as user photos.
  expect(reviews.every(row => !('photos' in row))).toBe(true)
})

it(`renders and filters the real fixture in ${theme}`, async () => {
  UnistylesSheet.configure({ themes: { [theme]: themes[theme] } as typeof themes })
  await renderScreen(<MyContributionsScreen />)
  expect(screen.getAllByTestId('contribution-review-card')).toHaveLength(4)
  expect(screen.getByRole('tab', { name: 'Đánh giá (4)' })).toBeTruthy()
  expect(screen.getByText('Đã hiển thị')).toBeTruthy()
  expect(screen.getByText('Chờ duyệt')).toBeTruthy()
  expect(screen.getByText('Lý do: Đánh giá chưa đủ chi tiết trải nghiệm thực tế')).toBeTruthy()
  expect(StyleSheet.flatten(screen.getAllByTestId('contribution-review-card')[0].props.style).backgroundColor).toBe(themes[theme].surface.card)
  expect(screen.getAllByTestId('place-photo-placeholder', { includeHiddenElements: true })).toHaveLength(4)
  expect(screen.queryByTestId('contribution-review-photos')).toBeNull()
  expect(screen.getByText(reviews[0].text!).props.numberOfLines).toBe(2)
  await fireEvent.press(screen.getByRole('button', { name: 'Đã hiển thị (1)' }))
  expect(screen.getAllByTestId('contribution-review-card')).toHaveLength(1)
  expect(screen.getByText('The Workshop Coffee')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'The Workshop Coffee' }))
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/places/[placeId]', params: { placeId: reviews[0].placeId } })
  await fireEvent.press(screen.getByRole('button', { name: 'Chờ duyệt (1)' }))
  expect(screen.getByText('Mơ Concept & Roastery')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Bị từ chối (1)' }))
  expect(screen.getByText('Quán Cà Phê Cũ')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Đã gỡ (1)' }))
  expect(screen.getByText('Địa điểm từng ghé')).toBeTruthy()
})

it(`has independent review loading, error, offline and empty states in ${theme}`, async () => {
  UnistylesSheet.configure({ themes: { [theme]: themes[theme] } as typeof themes })
  mockReviews = { ...mockReviews, data: undefined, isPending: true }
  const view = await renderScreen(<MyContributionsScreen />)
  expect(screen.getAllByTestId('contribution-reviews-skeleton')).toHaveLength(2)
  expect(screen.queryByTestId('contribution-places-skeleton')).toBeNull()
  mockOnline = false
  await view.rerender(<MyContributionsScreen />)
  expect(screen.queryByTestId('contribution-reviews-skeleton')).toBeNull()
  mockOnline = true
  mockReviews = { ...mockReviews, isPending: false, isError: true, error: new Error('private') }
  await view.rerender(<MyContributionsScreen />)
  expect(screen.queryByText('private')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }))
  expect(mockRefresh).toHaveBeenCalledTimes(1)
  mockReviews = { ...mockReviews, isError: false, data: [] }
  await view.rerender(<MyContributionsScreen />)
  expect(screen.getByText('Bạn chưa viết đánh giá nào')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Khám phá địa điểm' }))
  expect(mockRouter.push).toHaveBeenCalledWith('/places/search')
  expect(screen.getByRole('button', { name: 'Bị từ chối (0)' })).toBeTruthy()
})

it.each(reviews)(`opens the reviewed place from the whole $status card in ${theme}`, async review => {
  mockReviews = { ...mockReviews, data: [review] }
  await renderScreen(<MyContributionsScreen />)
  const card = screen.getByTestId('contribution-review-card')
  expect(card).toHaveProp('accessibilityRole', 'button')
  expect(card).toHaveProp('accessibilityLabel', review.placeName)
  await fireEvent.press(card)
  expect(mockRouter.push).toHaveBeenCalledTimes(1)
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/places/[placeId]', params: { placeId: review.placeId } })
})

it(`keeps a review without a place non-interactive in ${theme}`, async () => {
  mockReviews = { ...mockReviews, data: [{ ...reviews[0], placeId: undefined, placeName: undefined, planTitle: 'Chuyến đi cuối tuần' }] }
  await renderScreen(<MyContributionsScreen />)
  const card = screen.getByTestId('contribution-review-card')
  expect(card.props.accessibilityRole).toBeUndefined()
  await fireEvent.press(card)
  expect(mockRouter.push).not.toHaveBeenCalled()
})

it(`supports user photos and +N in the shared card in ${theme}, without inventing response fields`, async () => {
  UnistylesSheet.configure({ themes: { [theme]: themes[theme] } as typeof themes })
  const photos = Array.from({ length: 5 }, (_, i) => ({ url: `https://example.com/user-photo-${i}.jpg` }))
  const view = await renderScreen(<ContributionReviewCard review={reviews[0]} name={reviews[0].placeName!} photos={photos} />)
  expect(screen.getAllByTestId('place-photo-image')).toHaveLength(3)
  expect(screen.getByText('+2 ảnh')).toBeTruthy()
  expect(screen.getAllByLabelText(/Ảnh đánh giá/)).toHaveLength(3)
  await act(async () => { await view.rerender(<ContributionReviewCard review={reviews[1]} name={reviews[1].placeName!} />) })
  expect(screen.queryByTestId('contribution-review-photos')).toBeNull()
  expect(screen.queryByText('+2 ảnh')).toBeNull()
})

}
