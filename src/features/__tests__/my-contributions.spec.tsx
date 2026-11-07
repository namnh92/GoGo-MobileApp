import { fireEvent, screen } from '@testing-library/react-native'
import { renderScreen } from './harness'
import MyContributionsScreen from '../contributions/my-contributions.view'

const mockRouter = { back: jest.fn(), push: jest.fn() }
const mockFetch = jest.fn()
const mockRefresh = jest.fn()
let mockStatus = 'user'
let mockQuery: any
const mockEnabled = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockStatus }) }))
jest.mock('@/shared/api/queries/use-my-place-submissions', () => ({ useMyPlaceSubmissions: (enabled: boolean) => { mockEnabled(enabled); return mockQuery } }))
const row = (id: string, status: string, extra = {}) => ({ id, status, name: id, createdAt: '2026-11-07T03:00:00Z', updatedAt: '2026-11-07T03:00:00Z', ...extra })
beforeEach(() => {
  jest.clearAllMocks()
  mockStatus = 'user'
  mockQuery = { data: { pages: [{ items: [row('Pending café', 'pending'), row('Approved café', 'approved', { placeId: 'p1', photoUrl: 'https://example.com/p.jpg' }), row('Merged café', 'merged', { placeId: 'p2' }), row('Rejected café', 'rejected', { rejectionReason: 'incorrect_location' })], nextCursor: null }] }, isPending: false, isError: false, isFetching: false, hasNextPage: false, fetchNextPage: mockFetch, refetch: mockRefresh }
})
it('renders dates, photo placeholders, translated reasons and approved/merged navigation', async () => {
  await renderScreen(<MyContributionsScreen />)
  expect(screen.getAllByText('Gửi ngày 07/11/2026')).toHaveLength(4)
  expect(screen.getAllByTestId('contribution-photo-placeholder')).toHaveLength(3)
  expect(screen.getByText('Sai vị trí')).toBeTruthy()
  const actions = screen.getAllByText('Xem địa điểm')
  await fireEvent.press(actions[1])
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/places/[placeId]', params: { placeId: 'p2' } })
  await fireEvent.press(screen.getByRole('button', { name: 'Đã duyệt' }))
  expect(screen.getByText('Approved café')).toBeTruthy()
  expect(screen.getByText('Merged café')).toBeTruthy()
  expect(screen.queryByText('Pending café')).toBeNull()
  await fireEvent.press(screen.getByText('+ Thêm địa điểm mới'))
  expect(mockRouter.push).toHaveBeenCalledWith('/places/import')
})
it('keeps cursor loading available under an empty filter and refreshes on pull', async () => {
  mockQuery.hasNextPage = true
  mockQuery.data.pages[0].items = [row('Pending café', 'pending')]
  await renderScreen(<MyContributionsScreen />)
  await fireEvent.press(screen.getByText('Bị từ chối'))
  expect(screen.getByText('Chưa có kết quả trong các đóng góp đã tải. Xem thêm để tìm tiếp.')).toBeTruthy()
  await fireEvent.press(screen.getByText('Xem thêm đóng góp'))
  expect(mockFetch).toHaveBeenCalledTimes(1)
  await screen.getByTestId('my-contributions-list').props.refreshControl.props.onRefresh()
  expect(mockRefresh).toHaveBeenCalledTimes(1)
})
it('shows loading, empty, error/retry and a sign-in gate', async () => {
  mockQuery.data = undefined
  mockQuery.isPending = true
  const view = await renderScreen(<MyContributionsScreen />)
  expect(screen.getByText('Đang tải…')).toBeTruthy()
  mockQuery.isPending = false
  await view.rerender(<MyContributionsScreen />)
  expect(screen.getByText('Chưa có đóng góp')).toBeTruthy()
  mockQuery.isError = true
  mockQuery.error = new Error('private detail')
  await view.rerender(<MyContributionsScreen />)
  await fireEvent.press(screen.getByText('Thử lại'))
  expect(mockRefresh).toHaveBeenCalled()
  expect(screen.queryByText('private detail')).toBeNull()
  mockStatus = 'guest'
  await view.rerender(<MyContributionsScreen />)
  expect(mockEnabled).toHaveBeenLastCalledWith(false)
  expect(screen.queryByTestId('my-contributions-list')).toBeNull()
})
