import { StyleSheet } from 'react-native'
import { act, fireEvent, screen } from '@testing-library/react-native'
import { renderScreen } from './harness'
import MyContributionsScreen from '../contributions/my-contributions.view'

const mockRouter = { back: jest.fn(), push: jest.fn() }
const mockFetch = jest.fn()
const mockRefresh = jest.fn()
const mockReviewRefresh = jest.fn()
const mockOpenWebsite = jest.fn()
const mockToggle = jest.fn()
const mockEnabled = jest.fn()
let mockStatus = 'user'
let mockOnline = true
let mockQuery: any
let mockReviews: any
let mockSaved: any
let mockMutation: any
let mockParams: any = {}
let mockDetail: any
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  usePlaceDetail: (id: string) => id ? mockDetail : { data: undefined },
  useMyReviews: () => mockReviews,
  useSaved: () => mockSaved,
  useToggleSaved: () => mockMutation,
}))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => mockOnline, currentOfflineSpell: () => 1 }))
jest.mock('@/features/notifications/unread-count', () => ({ useUnreadInbox: () => ({ count: 1, more: false }) }))
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }))
jest.mock('@/shared/navigation/external-links', () => ({ openWebsite: (uri: string) => mockOpenWebsite(uri) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockStatus }) }))
jest.mock('@/shared/api/queries/use-my-place-submissions', () => ({ useMyPlaceSubmission: () => ({}), useMyPlaceSubmissions: (enabled: boolean) => { mockEnabled(enabled); return mockQuery } }))
const row = (id: string, status: string, extra = {}) => ({ id, status, name: id, createdAt: '2026-11-07T03:00:00Z', updatedAt: '2026-11-07T03:00:00Z', ...extra })
beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockStatus = 'user'
  mockOnline = true
  mockParams = {}
  mockDetail = { data: { id: 'p1', name: 'Catalogue café' }, isError: false }
  mockSaved = { data: [], isError: false }
  mockMutation = { mutate: mockToggle, isPending: false, isError: false }
  mockReviews = { data: [{ id: 'r1', placeId: 'p1', placeName: 'Reviewed café', placeAddressText: 'Verified address', rating: 4, text: 'My experience', status: 'pending', createdAt: '2026-11-07T00:00:00Z' }, { id: 'r2', rating: 5, text: 'Published experience', status: 'published' }], refetch: mockReviewRefresh, isPending: false, isError: false }
  mockQuery = { data: { pages: [{ items: [row('Pending café', 'pending'), row('Approved café', 'approved', { placeId: 'p1', photoUrl: 'https://example.com/p.jpg' }), row('Merged café', 'merged', { placeId: 'p2' }), row('Rejected café', 'rejected', { rejectionReason: 'incorrect_location' })], nextCursor: null }] }, isPending: false, isError: false, isFetching: false, hasNextPage: false, fetchNextPage: mockFetch, refetch: mockRefresh }
})
afterEach(async () => {
  await act(async () => { jest.runOnlyPendingTimers() })
  jest.useRealTimers()
})
it('switches real lists, resets the filter and routes creation with the Stitch tab dock', async () => {
  await renderScreen(<MyContributionsScreen />)
  expect(screen.getAllByText('Gửi ngày 07/11/2026')).toHaveLength(4)
  expect(screen.getByText('Lý do: Sai vị trí')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Đã duyệt (2)' }))
  expect(screen.queryByText('Pending café')).toBeNull()
  await fireEvent.press(screen.getByRole('tab', { name: /Đánh giá/ }))
  expect(screen.getByText('Reviewed café')).toBeTruthy()
  expect(screen.getByText('Verified address')).toBeTruthy()
  expect(screen.getByText('Published experience')).toBeTruthy()
  expect(screen.getByText('07 thg 11, 2026')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Thêm địa điểm mới' })).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Đã hiển thị (1)' }))
  expect(screen.queryByText('My experience')).toBeNull()
  await fireEvent.press(screen.getByRole('tab', { name: /Địa điểm/ }))
  await fireEvent.press(screen.getByRole('button', { name: 'Thêm địa điểm mới' }))
  expect(mockRouter.push).toHaveBeenCalledWith('/places/import')
  expect(screen.queryByTestId('contributions-bell')).toBeNull()
  expect(screen.queryByTestId('contributions-unread')).toBeNull()
  expect(mockRouter.push).not.toHaveBeenCalledWith('/notifications')
  expect(screen.getAllByRole('tab')).toHaveLength(6)
  expect(screen.getByRole('tab', { name: 'Đã lưu' })).toBeTruthy()
})
it('renders contribution records without saved-place controls or duplicate statuses', async () => {
  await renderScreen(<MyContributionsScreen />)
  expect(screen.queryByTestId('contribution-save-Pending café')).toBeNull()
  expect(screen.queryByTestId('contribution-save-Approved café')).toBeNull()
  expect(screen.queryByText('Chỉ lưu được địa điểm đã duyệt và công khai.')).toBeNull()
  expect(screen.queryByText('Đang kiểm duyệt nội dung')).toBeNull()
  expect(screen.queryByText('Đã xuất hiện trên GoGo')).toBeNull()
  expect(screen.getAllByTestId('contribution-place-card')).toHaveLength(4)
  expect(mockToggle).not.toHaveBeenCalled()
})
it('retains rejected supplement and attribution, prefilling a real link; locks missing links', async () => {
  const url = 'https://maps.google.com/?cid=123'
  mockQuery.data.pages[0].items = [row('Rejected café', 'rejected', { providerDisplay: { attributions: ['Google Maps'], googleMapsUri: url } }), row('No link café', 'rejected')]
  await renderScreen(<MyContributionsScreen />)
  await fireEvent.press(screen.getByRole('link', { name: 'Google Maps' }))
  expect(mockOpenWebsite).toHaveBeenCalledWith(url)
  const links = screen.getAllByRole('link', { name: 'Bổ sung thông tin khác' })
  await fireEvent.press(links[0])
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/places/import', params: { url } })
  expect(screen.getByText('Không có liên kết để bổ sung thông tin.')).toBeTruthy()
})
it('keeps cursor loading available under an empty filter, deduplicates pages and refreshes', async () => {
  mockQuery.hasNextPage = true
  const pending = row('Pending café', 'pending')
  mockQuery.data.pages = [{ items: [pending] }, { items: [pending] }]
  await renderScreen(<MyContributionsScreen />)
  expect(screen.getAllByText('Gửi ngày 07/11/2026')).toHaveLength(1)
  expect(screen.getByRole('tab', { name: 'Địa điểm (1+)' })).toBeTruthy()
  await fireEvent.press(screen.getByText('Bị từ chối (0+)'))
  expect(screen.getByText('Chưa có kết quả trong các đóng góp đã tải. Xem thêm để tìm tiếp.')).toBeTruthy()
  await fireEvent.press(screen.getByText('Xem thêm đóng góp'))
  expect(mockFetch).toHaveBeenCalledTimes(1)
  await screen.getByTestId('my-contributions-list').props.refreshControl.props.onRefresh()
  expect(mockRefresh).toHaveBeenCalledTimes(1)
})
it('renders loading, offline, error/retry, independent empty states and the sign-in gate', async () => {
  mockQuery.data = undefined
  mockQuery.isPending = true
  const view = await renderScreen(<MyContributionsScreen />)
  expect(screen.getAllByTestId('contribution-places-skeleton')).toHaveLength(2)
  mockQuery.isPaused = true
  await view.rerender(<MyContributionsScreen />)
  expect(screen.queryByTestId('contribution-places-skeleton')).toBeNull()
  mockQuery.isPending = false
  mockQuery.isError = true
  mockQuery.error = new Error('private detail')
  await view.rerender(<MyContributionsScreen />)
  await fireEvent.press(screen.getByText('Thử lại'))
  expect(mockRefresh).toHaveBeenCalled()
  expect(screen.queryByText('private detail')).toBeNull()
  mockQuery.isError = false
  await view.rerender(<MyContributionsScreen />)
  expect(screen.getByText('Bạn chưa có đóng góp nào')).toBeTruthy()
  mockReviews.data = []
  await fireEvent.press(screen.getByRole('tab', { name: /Đánh giá/ }))
  expect(screen.getByText('Bạn chưa viết đánh giá nào')).toBeTruthy()
  await fireEvent.press(screen.getByText('Khám phá địa điểm'))
  expect(mockRouter.push).toHaveBeenCalledWith('/places/search')
  mockReviews.isError = true
  await view.rerender(<MyContributionsScreen />)
  await fireEvent.press(screen.getByText('Thử lại'))
  expect(mockReviewRefresh).toHaveBeenCalled()
  mockStatus = 'guest'
  await view.rerender(<MyContributionsScreen />)
  expect(mockEnabled).toHaveBeenLastCalledWith(false)
  expect(screen.queryByTestId('my-contributions-reviews')).toBeNull()
})
it('opens the review tab from Profile and retains rejected/removed statuses', async () => {
  mockParams = { tab: 'reviews' }
  mockReviews.data.push({ id: 'r3', rating: 2, status: 'rejected', rejectionReason: 'Moderated reason' }, { id: 'r4', rating: 1, status: 'removed' })
  await renderScreen(<MyContributionsScreen />)
  expect(screen.getByText('Lý do: Moderated reason')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Đã gỡ (1)' }))
  expect(screen.queryByText('My experience')).toBeNull()
})

it('renders counted inset segments and the full-width add action from Stitch', async () => {
  await renderScreen(<MyContributionsScreen />)
  expect(StyleSheet.flatten(screen.getByTestId('filled-segmented-control').props.style)).toMatchObject({ borderRadius: 16, marginHorizontal: 16 })
  expect(screen.getByRole('tab', { name: 'Địa điểm (4)' }).props.accessibilityState.selected).toBe(true)
  expect(screen.getByRole('tab', { name: 'Đánh giá (2)' }).props.accessibilityState.selected).toBe(false)
  expect(screen.getByRole('button', { name: 'Thêm địa điểm mới' })).toBeTruthy()
  expect(screen.queryByTestId('contributions-add-fab')).toBeNull()
  expect(screen.queryByText('Bạn chưa có đóng góp nào')).toBeNull()
  await fireEvent.press(screen.getByRole('tab', { name: 'Đánh giá (2)' }))
  expect(screen.queryByRole('button', { name: 'Thêm địa điểm mới' })).toBeNull()
  expect(screen.getAllByRole('tab')).toHaveLength(6)
})

it.each([
  ['Đang chờ duyệt', 'Bạn chưa có địa điểm nào đang chờ duyệt'],
  ['Đã duyệt', 'Bạn chưa có địa điểm nào được duyệt'],
  ['Bị từ chối', 'Bạn chưa có địa điểm nào bị từ chối'],
])('shows the real Places empty state for %s even when there are no submissions', async (label, title) => {
  mockQuery.data.pages[0].items = []
  const view = await renderScreen(<MyContributionsScreen />)
  expect(screen.getByText('Bạn chưa có đóng góp nào')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: `${label} (0)` }))
  expect(screen.getByText(title)).toBeTruthy()
  expect(screen.queryByText('Bạn chưa có đóng góp nào')).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Thêm địa điểm' }))
  expect(mockRouter.push).toHaveBeenCalledWith('/places/import')
  // A non-empty list with no matches uses the same filter-specific empty state.
  mockQuery.data.pages[0].items = [row('Other café', label === 'Đang chờ duyệt' ? 'approved' : 'pending')]
  await view.rerender(<MyContributionsScreen />)
  expect(screen.getByText(title)).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Tất cả (1)' }))
  expect(screen.getByText('Other café')).toBeTruthy()
  expect(screen.queryByText(title)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Thêm địa điểm' })).toBeNull()
})
it('shows a Reviews empty state only for the active filter with its explore action', async () => {
  mockParams = { tab: 'reviews' }
  mockReviews.data = [mockReviews.data[0]]
  await renderScreen(<MyContributionsScreen />)
  expect(screen.queryByText('Bạn chưa viết đánh giá nào')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Khám phá địa điểm' })).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Đã hiển thị (0)' }))
  expect(screen.getByText('Bạn chưa có đánh giá nào được duyệt')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Khám phá địa điểm' }))
  expect(mockRouter.push).toHaveBeenCalledWith('/places/search')
  expect(screen.queryByTestId('contributions-add-fab')).toBeNull()
})
