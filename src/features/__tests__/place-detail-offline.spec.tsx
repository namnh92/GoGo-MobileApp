import { act, fireEvent, screen, within } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'

import { loaded as mockLoaded, pausedOffline, renderScreen, type QueryLike } from './harness'

import { OFFLINE_SIGNAL_DELAY_MS } from '@/shared/api/queries/use-online-status'

/**
 * GoGo-MobileApp#253 — Place Detail offline. One bar per screen: the reviews
 * section used to repeat the screen's offline bar word for word. With nothing
 * cached the screen used to keep its skeleton forever.
 */
const OFFLINE = 'Đang ngoại tuyến — đây là bản đã lưu trên máy.'
const FAILED = 'Chưa cập nhật được — đây là bản đã lưu trên máy.'
const NO_CONNECTION = 'Không có kết nối'

const mockBack = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => ({ placeId: 'place-1' }),
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'guest' }) }))

let mockPlace: QueryLike
let mockReviews: QueryLike

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlaceDetail: () => mockPlace,
  usePlaceReviews: () => mockReviews,
  useMyReviewReactions: () => mockLoaded({ placeId: 'place-1', helpful: [] }),
  useToggleReviewHelpful: () => ({ mutate: jest.fn(), isPending: false, variables: undefined }),
  useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: jest.fn() }),
  useTaxonomyLabel: () => ({ resolve: (_kind: string, key: string) => key }),
}))

import PlaceDetailScreen from '@/features/date-plan/place-detail.view'

const PLACE = { id: 'place-1', name: 'Quán thử', photos: [] }
const REVIEWS = {
  source: 'gogo',
  order: 'latest',
  reviews: [
    {
      id: 'review-1',
      rating: 5,
      createdAt: '2026-09-11T05:00:00.000Z',
      text: 'Nội dung 1',
      author: { displayName: 'Người viết 1' },
      helpfulCount: 0,
    },
  ],
}

async function elapseOfflineDelay() {
  await act(async () => {
    jest.advanceTimersByTime(OFFLINE_SIGNAL_DELAY_MS)
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  mockBack.mockClear()
  mockPlace = mockLoaded(PLACE)
  mockReviews = mockLoaded(REVIEWS)
})

afterEach(async () => {
  await act(async () => {
    onlineManager.setOnline(true)
  })
  jest.useRealTimers()
})

describe('Place Detail × connectivity', () => {
  it('shows one offline bar when the place and its reviews are both cached', async () => {
    onlineManager.setOnline(false)
    const view = await renderScreen(<PlaceDetailScreen />)
    await elapseOfflineDelay()
    expect(view.getByText('Nội dung 1')).toBeTruthy()
    expect(view.getAllByText(OFFLINE)).toHaveLength(1)
    expect(within(screen.getByTestId('place-reviews')).queryByText(OFFLINE)).toBeNull()
  })

  it('reports a failed review refresh inside the reviews section, once', async () => {
    mockReviews = { ...mockLoaded(REVIEWS), isError: true, error: new Error('500') }
    const view = await renderScreen(<PlaceDetailScreen />)
    expect(within(screen.getByTestId('place-reviews')).getByText(FAILED)).toBeTruthy()
    expect(view.getAllByText(FAILED)).toHaveLength(1)
  })

  it('shows the offline state with a way back when nothing is cached', async () => {
    mockPlace = pausedOffline()
    onlineManager.setOnline(false)
    const view = await renderScreen(<PlaceDetailScreen />)
    expect(view.queryByText(NO_CONNECTION)).toBeNull()

    await elapseOfflineDelay()
    expect(view.getByText(NO_CONNECTION)).toBeTruthy()
    await act(async () => {
      fireEvent.press(view.getByLabelText('Quay lại'))
    })
    expect(mockBack).toHaveBeenCalledTimes(1)
  })
})
