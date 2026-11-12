import { within } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { loaded, loaded as mockLoaded, roomFor, renderScreen, type QueryLike } from './harness'
import { text } from '@/shared/ui/tokens'

const mockIdleMutation = {
  mutate: jest.fn(),
  mutateAsync: jest.fn(async () => ({ code: 'ABC123' })),
  isPending: false,
  isError: false,
  error: null,
}

const mockRoom: { query: QueryLike } = { query: loaded(roomFor('couple')) }
const mockParams = { roomId: '311f5bd8-f853-4ced-af68-e04398d1451a' }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useNavigationContainerRef: () => ({ isReady: () => true }),
}))

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => mockRoom.query,
  useRoomMembers: () => mockLoaded([]),
  useCurrentSuggestions: () => ({ isPending: false, isError: false, data: undefined, error: null }),
  useCurrentPlan: () => ({ isPending: false, isError: false, data: undefined, error: null }),
  useRoomRealtime: jest.fn(() => ({ status: 'live' })),
  useCreateRoomInvite: () => ({ ...mockIdleMutation, stored: null, forget: jest.fn() }),
  useRoomInvites: () => ({ isPending: false, isError: false, isFetching: false, status: 'success', data: [], dataUpdatedAt: 1, refetch: jest.fn() }),
  useRevokeRoomInvite: () => mockIdleMutation,
  useStartMatching: () => mockIdleMutation,
}))

import GoGoRoomScreen from '@/features/gogo-room/gogo-room.view'

it('renders the couple hero copy in a theme text colour without a fabricated partner', async () => {
  const view = await renderScreen(<GoGoRoomScreen />)
  const body = view.getByText('Hai người sẽ chọn riêng. Không ai thấy lựa chọn của người kia cho tới khi match.')
  expect(StyleSheet.flatten(body.props.style).color).toBe(text.secondary)
  expect(view.queryByText('+')).toBeNull()
})

it.each(['couple', 'group-host'] as const)('shows manage only to the host in %s rooms', async audience => {
  for (const myRole of ['host', 'member'] as const) {
    mockRoom.query = mockLoaded(roomFor(audience, { myRole }))
    const view = await renderScreen(<GoGoRoomScreen />)
    if (myRole === 'host') expect(view.getByRole('button', { name: 'Sửa' })).toBeTruthy()
    else {
      expect(view.queryByRole('button', { name: 'Sửa' })).toBeNull()
      expect(view.queryByRole('button', { name: 'Quản lý phòng' })).toBeNull()
      expect(view.getByText('Thiết lập bởi chủ phòng')).toBeTruthy()
    }
    await view.unmount()
  }
})

it.each(['couple', 'group-host'] as const)('orders lobby facts for %s hosts and members', async audience => {
  for (const myRole of ['host', 'member'] as const) {
    mockRoom.query = mockLoaded(roomFor(audience, { myRole, constraints: {
      budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND',
      administrativeArea: { datasetVersion: 'v1', provinceCode: '01', provinceName: 'Hà Nội', communeCode: null, communeName: null, status: 'current' },
      startAt: new Date(2026, 10, 11, 23).toISOString(), endAt: new Date(2026, 10, 12, 1).toISOString(),
    } }))
    const view = await renderScreen(<GoGoRoomScreen />)
    expect(view.getAllByTestId(/^room-fact-/).map(node => node.props.testID)).toEqual([
      'room-fact-area', 'room-fact-budget', 'room-fact-schedule',
    ])
    expect(view.getByText('23:00 11/11/2026 – 01:00 12/11/2026')).toBeTruthy()
    await view.unmount()
  }
})
it('omits absent lobby area and budget facts', async () => {
  mockRoom.query = mockLoaded(roomFor('couple', { constraints: { budgetMode: 'per_person', budgetAmount: 0, currency: 'VND', administrativeArea: null, startAt: new Date(2026, 10, 11, 23).toISOString() } }))
  const view = await renderScreen(<GoGoRoomScreen />)
  expect(view.queryByTestId('room-fact-area')).toBeNull()
  expect(view.queryByTestId('room-fact-budget')).toBeNull()
  expect(view.getByTestId('room-fact-schedule')).toBeTruthy()
})

it.each(['couple', 'group-host'] as const)('marks only the host avatar for %s hosts and members', async audience => {
  for (const myRole of ['host', 'member'] as const) {
    mockRoom.query = mockLoaded(roomFor(audience, { myRole }))
    const view = await renderScreen(<GoGoRoomScreen />)
    const host = view.getByLabelText(/^Tôi, Chủ phòng,/)
    expect(within(host).getByTestId('avatar-host-badge')).toBeTruthy()
    const member = view.getByLabelText(/^Người 1, Thành viên,/)
    expect(within(member).queryByTestId('avatar-host-badge')).toBeNull()
    expect(view.getAllByTestId('avatar-host-badge')).toHaveLength(1)
    expect(view.queryByText('Chủ phòng')).toBeNull()
    await view.unmount()
  }
})
