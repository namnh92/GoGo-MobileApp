import { fireEvent } from '@testing-library/react-native'
import { renderScreen } from './harness'

/**
 * #247 — "Vào phòng bằng mã" lived only in the Plans tab's empty states, so a
 * person who already had a room had no way to enter an invite code in the app.
 * The entry is always there for anyone who can hold a room, and exactly once.
 */

const mockPush = jest.fn()
const mockSession = { status: 'user' as 'user' | 'guest' | 'signed_out' }
const mockItems: { id: string; title: string; status: string; type: string; participantCount: number }[] = []
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: () => undefined }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => mockSession }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMyRooms: () => ({
    data: { pages: [{ items: mockItems }] },
    isPending: false, isError: false, isFetching: false, isFetchingNextPage: false,
    hasNextPage: false, isFetchNextPageError: false, error: null, dataUpdatedAt: 0,
    fetchNextPage: jest.fn(), refetch: jest.fn(),
  }),
}))

import PlansScreen from '@/features/tabs/plans.view'

const JOIN = 'Vào phòng bằng mã'
const ROOM = { id: 'a', title: 'Phòng đã có', status: 'collecting', type: 'group', participantCount: 4 }

beforeEach(() => {
  jest.clearAllMocks()
  mockItems.length = 0
})

it.each(['user', 'guest'] as const)('a %s who already has a room can still enter a code', async status => {
  mockSession.status = status
  mockItems.push(ROOM)
  const view = await renderScreen(<PlansScreen />)
  expect(view.getByText('Phòng đã có')).toBeTruthy()
  await fireEvent.press(view.getByText(JOIN))
  expect(mockPush).toHaveBeenCalledWith('/join')
})

it.each(['user', 'guest'] as const)('a %s with no rooms sees the entry once, not twice', async status => {
  mockSession.status = status
  const view = await renderScreen(<PlansScreen />)
  expect(view.getAllByText(JOIN)).toHaveLength(1)
})

it('the history tab keeps the entry', async () => {
  mockSession.status = 'user'
  mockItems.push(ROOM)
  const view = await renderScreen(<PlansScreen />)
  await fireEvent.press(view.getByRole('tab', { name: 'Lịch sử' }))
  expect(view.getAllByText(JOIN)).toHaveLength(1)
})
