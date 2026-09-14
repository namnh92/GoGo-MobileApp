import { fireEvent, screen, within } from '@testing-library/react-native'

import {
  failed as mockFailed,
  loaded as mockLoaded,
  pending as mockPending,
  renderScreen,
  type QueryLike,
} from './harness'

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ placeId: 'place-1' }),
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'guest' }) }))

let mockReviews: QueryLike
const mockUsePlaceReviews = jest.fn((_placeId: string, _order?: string) => mockReviews)

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlaceDetail: () =>
    mockLoaded({ id: 'place-1', name: 'Quán thử', rating: 4.6, ratingCount: 812, photos: [] }),
  usePlaceReviews: (placeId: string, order?: string) => mockUsePlaceReviews(placeId, order),
  useMyReviewReactions: () => mockLoaded({ placeId: 'place-1', helpful: [] }),
  useToggleReviewHelpful: () => ({ mutate: jest.fn(), isPending: false, variables: undefined }),
  useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: jest.fn() }),
  useTaxonomyLabel: () => ({ resolve: (_kind: string, key: string) => key }),
}))

import PlaceDetailScreen from '@/features/date-plan/place-detail.view'

function review(n: number, over: { displayName?: string | null; rating?: number } = {}) {
  return {
    id: `review-${n}`,
    rating: over.rating ?? 5,
    createdAt: `2026-09-1${n}T05:00:00.000Z`,
    text: `Nội dung ${n}`,
    author: { displayName: over.displayName === undefined ? `Người viết ${n}` : over.displayName },
    helpfulCount: 0,
  }
}

const preview = (...reviews: ReturnType<typeof review>[]) => mockLoaded({ source: 'gogo', order: 'latest', reviews })
const section = () => within(screen.getByTestId('place-reviews'))

beforeEach(() => {
  mockReviews = preview()
  mockUsePlaceReviews.mockClear()
})

it('reads this place and says honestly when no GoGo review is published', async () => {
  await renderScreen(<PlaceDetailScreen />)

  expect(mockUsePlaceReviews).toHaveBeenCalledWith('place-1', 'latest')
  expect(section().getByText('Đánh giá gần nhất trên GoGo')).toBeTruthy()
  expect(section().getByText('Chưa có đánh giá GoGo nào được duyệt cho địa điểm này.')).toBeTruthy()
  expect(section().queryByText(/^★/)).toBeNull()
})

it('shows one review with its author, date, rating, text and GoGo attribution', async () => {
  mockReviews = preview(review(1, { rating: 4 }))
  await renderScreen(<PlaceDetailScreen />)

  const reviews = section()
  expect(reviews.getByText('Người viết 1')).toBeTruthy()
  expect(reviews.getByText('★ 4/5')).toBeTruthy()
  expect(reviews.getByText(/^Viết ngày \S+/)).toBeTruthy()
  expect(reviews.getByText('Nội dung 1')).toBeTruthy()
  expect(reviews.getByText('Từ cộng đồng GoGo, đã qua kiểm duyệt. Không gộp với điểm Google.')).toBeTruthy()
  expect(reviews.getByLabelText(/^Người viết 1\. 4 trên 5 sao\. Viết ngày .+\. Nội dung 1$/)).toBeTruthy()
})

it('shows three reviews in the order the server ranked them', async () => {
  mockReviews = preview(review(3), review(2), review(1))
  await renderScreen(<PlaceDetailScreen />)

  const authors = section()
    .getAllByText(/^Người viết \d$/)
    .map(node => node.props.children)
  expect(authors).toEqual(['Người viết 3', 'Người viết 2', 'Người viết 1'])
})

it('labels a deleted author rather than leaving the name blank', async () => {
  mockReviews = preview(review(1, { displayName: null }))
  await renderScreen(<PlaceDetailScreen />)

  expect(section().getByText('Người dùng đã xóa')).toBeTruthy()
})

it('keeps GoGo reviews apart from the Google rating', async () => {
  mockReviews = preview(review(1, { rating: 1 }), review(2, { rating: 1 }))
  await renderScreen(<PlaceDetailScreen />)

  // Google's number stays in Google's places; the GoGo card still has no
  // aggregate, because two reviews are not a community rating.
  expect(screen.getAllByText('★ 4.6').length).toBeGreaterThan(0)
  expect(screen.getByText('Chưa đủ đánh giá từ cộng đồng GoGo')).toBeTruthy()
  expect(section().queryByText('★ 4.6')).toBeNull()
  expect(section().getAllByText('★ 1/5')).toHaveLength(2)
})

it('keeps the place detail on screen while reviews load', async () => {
  mockReviews = mockPending()
  await renderScreen(<PlaceDetailScreen />)

  expect(screen.getByText('Quán thử')).toBeTruthy()
  expect(section().getByLabelText('Đang tải đánh giá GoGo')).toBeTruthy()
})

it('fails inside its own section with a retry, and the place detail stays usable', async () => {
  mockReviews = mockFailed()
  await renderScreen(<PlaceDetailScreen />)

  expect(screen.getByText('Quán thử')).toBeTruthy()
  expect(screen.getByText('Chỉ đường')).toBeTruthy()
  expect(section().getByText('Chưa tải được đánh giá GoGo.')).toBeTruthy()
  await fireEvent.press(section().getByText('Thử lại'))
  expect(mockReviews.refetch).toHaveBeenCalledTimes(1)
})

it('keeps cached reviews and says so when a refetch fails', async () => {
  mockReviews = { ...preview(review(1)), isError: true, error: new Error('boom') }
  await renderScreen(<PlaceDetailScreen />)

  expect(section().getByText('Nội dung 1')).toBeTruthy()
  expect(section().getByText('Chưa cập nhật được — đây là bản đã lưu trên máy.')).toBeTruthy()
})

it('drops a review once the server stops listing it after moderation', async () => {
  mockReviews = preview(review(3), review(2), review(1))
  await renderScreen(<PlaceDetailScreen />)
  expect(section().getByText('Nội dung 2')).toBeTruthy()

  mockReviews = preview(review(3), review(1))
  await screen.rerender(<PlaceDetailScreen />)

  expect(section().getByText('Nội dung 3')).toBeTruthy()
  expect(section().getByText('Nội dung 1')).toBeTruthy()
  expect(section().queryByText('Nội dung 2')).toBeNull()
})
