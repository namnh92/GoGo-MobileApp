import { fireEvent } from '@testing-library/react-native'
import { renderScreen } from './harness'

const mockFetch = jest.fn()
const mockQuery = {
  data: { pages: [{ items: [
    { id: 'a', title: 'Chưa hoàn tất', status: 'collecting', type: 'group', participantCount: 4, scheduledDate: '2020-01-01T12:00:00Z' },
    { id: 'b', title: 'Đã hoàn tất', status: 'completed', type: 'group', participantCount: 4 },
  ] }] },
  isPending: false, isError: false, isFetching: false, isFetchingNextPage: false,
  hasNextPage: false, isFetchNextPageError: false, error: null,
  fetchNextPage: mockFetch, refetch: jest.fn(),
}
const mockUseRooms = jest.fn((_options: unknown) => mockQuery)
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'), useMyRooms: (options: unknown) => mockUseRooms(options) }))

import PlansScreen from '@/features/tabs/plans.view'

it('filters by lifecycle, keeps overdue collecting rooms upcoming, and scopes each tab query', async () => {
  const view = await renderScreen(<PlansScreen />)
  expect(view.getByText('Chưa hoàn tất')).toBeTruthy()
  expect(view.queryByText('Đã hoàn tất')).toBeNull()
  await fireEvent.press(view.getByRole('tab', { name: 'Lịch sử' }))
  expect(view.getByText('Đã hoàn tất')).toBeTruthy()
  expect(view.queryByText('Chưa hoàn tất')).toBeNull()
  expect(mockUseRooms).toHaveBeenLastCalledWith({ enabled: true, status: 'completed,cancelled,expired' })
})

it('keeps pagination available when the server has another page', async () => {
  mockQuery.data = { pages: [{ items: [] }] }
  mockQuery.hasNextPage = true
  const view = await renderScreen(<PlansScreen />)
  await fireEvent.press(view.getByText('Xem thêm'))
  expect(mockFetch).toHaveBeenCalled()
})
