import { fireEvent } from '@testing-library/react-native'
import { renderScreen } from './harness'

/**
 * #247 — "Vào phòng bằng mã" lived only in the Plans tab's empty states, so a
 * signed-in person who already had a room had no way to enter an invite code in
 * the app. The entry is always there for a user, and exactly once.
 *
 * Not for a guest who already holds a room (#314 F-01): /join signs in as a new
 * guest and replaces that session, losing the room. Confirm-before-replace is
 * #272 (owner decision 2026-09-22); until then a guest keeps develop's entry,
 * which appears only in the empty state.
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

it('a user who already has a room can still enter a code', async () => {
  mockSession.status = 'user'
  mockItems.push(ROOM)
  const view = await renderScreen(<PlansScreen />)
  expect(view.getByText('Phòng đã có')).toBeTruthy()
  expect(view.getAllByText(JOIN)).toHaveLength(1)
  await fireEvent.press(view.getByText(JOIN))
  expect(mockPush).toHaveBeenCalledWith('/join')
})

it('a guest who already has a room is not offered a code that would replace their session', async () => {
  mockSession.status = 'guest'
  mockItems.push(ROOM)
  const view = await renderScreen(<PlansScreen />)
  expect(view.getByText('Phòng đã có')).toBeTruthy()
  expect(view.queryByText(JOIN)).toBeNull()
})

it.each(['user', 'guest'] as const)('a %s with no rooms sees the entry once, not twice', async status => {
  mockSession.status = status
  const view = await renderScreen(<PlansScreen />)
  expect(view.getAllByText(JOIN)).toHaveLength(1)
  await fireEvent.press(view.getByText(JOIN))
  expect(mockPush).toHaveBeenCalledWith('/join')
})

it('the history tab keeps the entry', async () => {
  mockSession.status = 'user'
  mockItems.push(ROOM)
  const view = await renderScreen(<PlansScreen />)
  await fireEvent.press(view.getByRole('tab', { name: 'Lịch sử' }))
  expect(view.getAllByText(JOIN)).toHaveLength(1)
})
