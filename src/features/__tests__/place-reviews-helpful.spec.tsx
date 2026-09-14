import { fireEvent, screen, within } from '@testing-library/react-native'

import { loaded as mockLoaded, renderScreen, type QueryLike } from './harness'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  useLocalSearchParams: () => ({ placeId: 'place-1' }),
}))

let mockStatus: 'user' | 'guest' | 'anonymous' = 'user'
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockStatus }) }))

type MutateOptions = { onSuccess?: () => void; onError?: (error: unknown) => void }
let mockReviews: QueryLike
let mockMine: QueryLike
let mockToggle: {
  mutate: jest.Mock<void, [{ reviewId: string; helpful: boolean }, MutateOptions?]>
  isPending: boolean
  variables: { reviewId: string; helpful: boolean } | undefined
}
const mockUsePlaceReviews = jest.fn((_placeId: string, _order: string) => mockReviews)
const mockUseMine = jest.fn((_placeId: string, _options: { enabled: boolean }) => mockMine)

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlaceDetail: () => mockLoaded({ id: 'place-1', name: 'Quán thử', photos: [] }),
  usePlaceReviews: (placeId: string, order: string) => mockUsePlaceReviews(placeId, order),
  useMyReviewReactions: (placeId: string, options: { enabled: boolean }) => mockUseMine(placeId, options),
  useToggleReviewHelpful: () => mockToggle,
  useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: jest.fn() }),
  useTaxonomyLabel: () => ({ resolve: (_kind: string, key: string) => key }),
}))

import { ApiError } from '@/shared/api'
import PlaceDetailScreen from '@/features/date-plan/place-detail.view'

function review(n: number, helpfulCount = 0) {
  return {
    id: `review-${n}`,
    rating: 5,
    createdAt: `2026-09-1${n}T05:00:00.000Z`,
    text: `Nội dung ${n}`,
    author: { displayName: `Người viết ${n}` },
    helpfulCount,
  }
}

const preview = (order: 'latest' | 'helpful', ...reviews: ReturnType<typeof review>[]) =>
  mockLoaded({ source: 'gogo', order, reviews })
const row = (n: number) => within(screen.getByTestId(`place-review-review-${n}`))
const section = () => within(screen.getByTestId('place-reviews'))

beforeEach(() => {
  mockStatus = 'user'
  mockReviews = preview('latest', review(2, 3), review(1, 0))
  mockMine = mockLoaded({ placeId: 'place-1', helpful: [] })
  mockToggle = { mutate: jest.fn(), isPending: false, variables: undefined }
  mockUsePlaceReviews.mockClear()
  mockUseMine.mockClear()
  mockPush.mockClear()
})

it('switches between the latest and the most helpful three', async () => {
  await renderScreen(<PlaceDetailScreen />)
  expect(mockUsePlaceReviews).toHaveBeenLastCalledWith('place-1', 'latest')
  expect(section().getByLabelText('Mới nhất').props.accessibilityState).toMatchObject({ selected: true })

  await fireEvent.press(section().getByLabelText('Hữu ích nhất'))
  expect(mockUsePlaceReviews).toHaveBeenLastCalledWith('place-1', 'helpful')
  expect(section().getByLabelText('Hữu ích nhất').props.accessibilityState).toMatchObject({ selected: true })

  await fireEvent.press(section().getByLabelText('Mới nhất'))
  expect(mockUsePlaceReviews).toHaveBeenLastCalledWith('place-1', 'latest')
})

it('says so when the helpful order is only the newest because nothing has a mark', async () => {
  mockReviews = preview('helpful', review(2), review(1))
  await renderScreen(<PlaceDetailScreen />)

  expect(
    section().getByText('Chưa có đánh giá nào được đánh dấu hữu ích, đang hiện đánh giá mới nhất.'),
  ).toBeTruthy()
})

it('lets a guest read counts and asks them to sign in instead of marking', async () => {
  mockStatus = 'guest'
  await renderScreen(<PlaceDetailScreen />)

  expect(mockUseMine).toHaveBeenLastCalledWith('place-1', { enabled: false })
  expect(row(2).getByText('Hữu ích · 3')).toBeTruthy()

  await fireEvent.press(row(2).getByLabelText('Đánh dấu hữu ích'))

  expect(mockToggle.mutate).not.toHaveBeenCalled()
  expect(section().getByText('Đăng nhập để đánh dấu đánh giá hữu ích.')).toBeTruthy()
  await fireEvent.press(section().getByText('Đăng nhập'))
  expect(mockPush).toHaveBeenCalledWith('/auth/sign-in?next=place:place-1')
})

it('marks and unmarks for an account, from what it already marked', async () => {
  mockMine = mockLoaded({ placeId: 'place-1', helpful: ['review-2'] })
  await renderScreen(<PlaceDetailScreen />)

  expect(mockUseMine).toHaveBeenLastCalledWith('place-1', { enabled: true })
  expect(row(2).getByText('✓ Hữu ích · 3')).toBeTruthy()
  expect(row(2).getByLabelText('Bỏ đánh dấu hữu ích').props.accessibilityState).toMatchObject({ checked: true })

  await fireEvent.press(row(1).getByLabelText('Đánh dấu hữu ích'))
  expect(mockToggle.mutate).toHaveBeenLastCalledWith({ reviewId: 'review-1', helpful: true }, expect.any(Object))

  await fireEvent.press(row(2).getByLabelText('Bỏ đánh dấu hữu ích'))
  expect(mockToggle.mutate).toHaveBeenLastCalledWith({ reviewId: 'review-2', helpful: false }, expect.any(Object))
})

it('sends nothing for a second tap while the first is still in flight', async () => {
  mockToggle = { mutate: jest.fn(), isPending: true, variables: { reviewId: 'review-1', helpful: true } }
  await renderScreen(<PlaceDetailScreen />)

  const inFlight = row(1).getByLabelText('Đánh dấu hữu ích')
  expect(inFlight.props.accessibilityState).toMatchObject({ disabled: true, busy: true })
  await fireEvent.press(inFlight)
  expect(mockToggle.mutate).not.toHaveBeenCalled()

  // Another review is not held up by it.
  await fireEvent.press(row(2).getByLabelText('Đánh dấu hữu ích'))
  expect(mockToggle.mutate).toHaveBeenCalledTimes(1)
})

it('explains a refused mark on your own review, and a generic failure otherwise', async () => {
  mockToggle.mutate.mockImplementationOnce((_variables, options) =>
    options?.onError?.(new ApiError(403, { code: 'OWN_REVIEW', message: 'own review' })),
  )
  await renderScreen(<PlaceDetailScreen />)

  await fireEvent.press(row(2).getByLabelText('Đánh dấu hữu ích'))
  expect(row(2).getByText('Bạn không thể đánh dấu đánh giá của chính mình.')).toBeTruthy()

  mockToggle.mutate.mockImplementationOnce((_variables, options) => options?.onError?.(new Error('offline')))
  await fireEvent.press(row(1).getByLabelText('Đánh dấu hữu ích'))
  expect(row(1).getByText('Chưa lưu được, vui lòng thử lại.')).toBeTruthy()
  expect(row(2).queryByText('Bạn không thể đánh dấu đánh giá của chính mình.')).toBeNull()
})

it('drops a review from the helpful three once moderation hides it', async () => {
  mockReviews = preview('helpful', review(2, 3), review(1, 1))
  await renderScreen(<PlaceDetailScreen />)
  expect(section().getByText('Nội dung 2')).toBeTruthy()

  mockReviews = preview('helpful', review(1, 1))
  await screen.rerender(<PlaceDetailScreen />)

  expect(section().getByText('Nội dung 1')).toBeTruthy()
  expect(section().queryByText('Nội dung 2')).toBeNull()
})
