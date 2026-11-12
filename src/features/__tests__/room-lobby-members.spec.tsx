import { act, fireEvent, screen, within } from '@testing-library/react-native'
import { QueryClient } from '@tanstack/react-query'
import { loaded as mockLoaded, roomFor } from './harness'
import { render } from '@/shared/ui/__tests__/query-render'
import type { RoomMember } from '@/shared/api'
import i18n from '@/shared/i18n'

const mockRemove = jest.fn()
const mockRefresh = jest.fn(async () => undefined)
const mockSeeds = jest.fn()
let mockRoom = roomFor('group-host')
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: '311f5bd8-f853-4ced-af68-e04398d1451a' }),
  useNavigationContainerRef: () => ({ isReady: () => true }),
  useFocusEffect: () => undefined,
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => ({ ...mockLoaded(mockRoom), refetch: mockRefresh }),
  useRoomRealtime: () => ({ status: 'live' }),
  useCurrentSuggestions: () => mockLoaded(undefined),
  useCurrentPlan: () => mockLoaded(undefined),
  useRoomInvites: () => mockLoaded([]),
  useSeedPlaceDetails: (seeds: { placeId: string }[]) => ({ byPlaceId: new Map(seeds.map(seed => [seed.placeId, mockLoaded({ id: seed.placeId, name: 'Quán thật' })])), refetchAll: mockSeeds }),
  useTaxonomies: () => mockLoaded(undefined),
  useRemoveRoomMember: () => ({ mutate: mockRemove }),
}))
import GoGoRoomScreen from '@/features/gogo-room/gogo-room.view'

let client: QueryClient
beforeEach(() => {
  // Seed FlatList batches cells on a timer; keep that work inside act under load.
  jest.useFakeTimers()
  jest.clearAllMocks()
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const members: RoomMember[] = Array.from({ length: 7 }, (_, index) => ({ id: `member-${index}`, displayName: `Người ${index}`, role: index ? 'member' : 'host', selectionStatus: 'pending', isGuest: false }))
  mockRoom = roomFor('group-host', { members, participantCount: members.length, seedPlaces: [{ placeId: 'seed-1', name: 'Quán thật' }], constraints: { budgetAmount: 500000, budgetMode: 'total', currency: 'VND', administrativeArea: { datasetVersion: 'v1', provinceCode: '01', provinceName: 'Hà Nội', communeCode: null, communeName: null, status: 'current' } } })
})
afterEach(async () => {
  try {
    await act(async () => { jest.runOnlyPendingTimers() })
  } finally {
    client.clear()
    jest.useRealTimers()
  }
})
async function press(id: string) { await act(async () => { await fireEvent.press(screen.getByTestId(id)) }) }

it('shows five rows, opens every member in a scrollable shared sheet, then confirms/removes/refreshes', async () => {
  await render(<GoGoRoomScreen />, client)
  expect(screen.getAllByTestId(/^room-lobby-member-\d/)).toHaveLength(5)
  expect(screen.queryByText('Người 6')).toBeNull()
  expect(screen.queryByTestId('room-lobby-remove-member-0')).toBeNull()
  await press('room-lobby-members-all')
  const sheet = screen.getByTestId('room-lobby-members-sheet')
  expect(within(sheet).getAllByTestId(/^room-lobby-sheet-member-\d/)).toHaveLength(7)
  expect(within(sheet).getByText('Người 6')).toBeTruthy()
  expect(within(sheet).queryByTestId('room-lobby-sheet-remove-member-0')).toBeNull()
  const dismissed = screen.getByTestId('room-lobby-members-sheet-modal').props.onDismiss
  await press('room-lobby-sheet-remove-member-6')
  await act(async () => { dismissed?.() })
  expect(screen.queryByTestId('room-lobby-members-sheet')).toBeNull()
  const confirm = screen.getByTestId('room-lobby-member-confirm')
  expect(within(confirm).getByText('Xoá Người 6 khỏi phòng?')).toBeTruthy()
  expect(mockRemove).not.toHaveBeenCalled()
  await act(async () => { await fireEvent.press(within(confirm).getByRole('button', { name: 'Xoá' })) })
  expect(mockRemove).toHaveBeenCalledWith('member-6', expect.any(Object))
  await act(async () => { mockRemove.mock.calls[0][1].onSuccess(); mockRemove.mock.calls[0][1].onSettled() })
  expect(mockRefresh).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId('room-lobby-member-confirm')).toBeNull()
})
it.each([0, 2, 5])('omits View all with %i members', async count => {
  mockRoom = { ...mockRoom, members: mockRoom.members!.slice(0, count) }
  await render(<GoGoRoomScreen />, client)
  expect(screen.queryByTestId('room-lobby-members-all')).toBeNull()
})
it('never offers View all in a couple room', async () => {
  mockRoom = roomFor('couple')
  await render(<GoGoRoomScreen />, client)
  expect(screen.queryByTestId('room-lobby-members-all')).toBeNull()
})
it.each(['member', 'guest'] as const)('shows seeds read-only and no host actions to a %s, including full members sheet', async actor => {
  mockRoom = { ...mockRoom, myRole: actor === 'guest' ? 'guest' as typeof mockRoom.myRole : 'member' }
  await render(<GoGoRoomScreen />, client)
  expect(screen.getByTestId('room-lobby-seeds')).toBeTruthy()
  expect(screen.getByTestId('place-card-small')).toBeTruthy()
  for (const id of ['room-lobby-seeds-add', 'place-card-remove', 'room-lobby-management', 'room-lobby-invite', 'room-lobby-cancel']) expect(screen.queryByTestId(id)).toBeNull()
  expect(screen.queryAllByRole('button', { name: /Mời .* ra khỏi phòng/ })).toHaveLength(0)
  await press('room-lobby-members-all')
  expect(within(screen.getByTestId('room-lobby-members-sheet')).getAllByTestId(/^room-lobby-sheet-member-\d/)).toHaveLength(7)
  expect(screen.queryAllByRole('button', { name: /Mời .* ra khỏi phòng/ })).toHaveLength(0)
})
it('shows host seed add/remove with member-name accessibility labels', async () => {
  await render(<GoGoRoomScreen />, client)
  expect(screen.getByTestId('room-lobby-seeds-add')).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Bỏ Quán thật khỏi địa điểm gợi ý' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Mời Người 1 ra khỏi phòng' })).toBeTruthy()
})
it('localizes the expanded members affordance in English', async () => {
  await act(async () => { await i18n.changeLanguage('en') })
  try { await render(<GoGoRoomScreen />, client); expect(screen.getByRole('button', { name: 'View all (7)' })).toBeTruthy() }
  finally { await act(async () => { await i18n.changeLanguage('vi') }) }
})
