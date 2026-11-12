import { within } from '@testing-library/react-native'

import { loaded, loaded as mockLoaded, roomFor, renderScreen, type QueryLike } from './harness'
import i18n from '@/shared/i18n'
import { roomBudgetLabel } from '@/shared/pricing/budget-unit'

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

it('removes the couple hero and body invite card', async () => {
  mockRoom.query = loaded(roomFor('couple'))
  const view = await renderScreen(<GoGoRoomScreen />)
  expect(view.queryByText(i18n.t('gogoRoom.body', { context: 'couple' }))).toBeNull()
  expect(view.queryByText('Tạo mã mời')).toBeNull()
  expect(view.getAllByRole('button', { name: 'Mời người tham gia' })).toHaveLength(1)
  expect(within(view.getByTestId('room-lobby-scroll')).queryByRole('button', { name: 'Mời người tham gia' })).toBeNull()
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

it.each(['Friday crew', '', '   ', undefined])('shows a group host name first only when set (%s)', async title => {
  mockRoom.query = mockLoaded(roomFor('group-host', { title }))
  const view = await renderScreen(<GoGoRoomScreen />)
  if (title?.trim()) {
    expect(view.getAllByTestId(/^room-fact-/)[0].props.testID).toBe('room-fact-name')
    expect(within(view.getByTestId('room-fact-name')).getByText(title)).toBeTruthy()
    expect(view.getAllByText(title)).toHaveLength(2)
  } else expect(view.queryByTestId('room-fact-name')).toBeNull()
})
it.each(['couple', 'group-host', 'group-guest'] as const)('uses a trimmed header title with type fallback for %s', async audience => {
  for (const title of ['  Friday crew  ', '', '   ', undefined]) {
    mockRoom.query = mockLoaded(roomFor(audience, { title }))
    const view = await renderScreen(<GoGoRoomScreen />)
    const header = view.getByTestId('room-lobby-header-title')
    expect(header).toHaveTextContent(title?.trim() || i18n.t(audience === 'couple' ? 'roomLobby.coupleTitle' : audience === 'group-host' ? 'gogoRoom.title_group' : 'roomLobby.group'))
    expect(header.props).toMatchObject({ numberOfLines: 1, ellipsizeMode: 'tail' })
    await view.unmount()
  }
})
it.each(['total', 'per_person'] as const)('uses the shared full budget formatter for %s', async budgetMode => {
  const room = roomFor('couple', { constraints: { budgetMode, budgetAmount: 500000, currency: 'VND', administrativeArea: null } })
  mockRoom.query = loaded(room)
  const view = await renderScreen(<GoGoRoomScreen />)
  expect(within(view.getByTestId('room-fact-budget')).getByText(roomBudgetLabel(room.constraints!, room.participantCount, i18n.t))).toBeTruthy()
})
it('omits the schedule fact when the room has no schedule', async () => {
  mockRoom.query = loaded(roomFor('couple'))
  const view = await renderScreen(<GoGoRoomScreen />)
  expect(view.queryByTestId('room-fact-schedule')).toBeNull()
})
it('orders conditions, members, seeds and host management', async () => {
  mockRoom.query = loaded(roomFor('group-host'))
  const view = await renderScreen(<GoGoRoomScreen />)
  expect(view.getAllByTestId(/^room-lobby-(conditions|members|seeds|management)$/).map(node => node.props.testID)).toEqual([
    'room-lobby-conditions', 'room-lobby-members', 'room-lobby-seeds', 'room-lobby-management',
  ])
})
