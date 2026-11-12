import { themes } from '@/shared/ui/theme'
import { ThemeScopeProvider } from '@/shared/ui/scoped-theme'
import { Alert, StyleSheet } from 'react-native'
import { text, type } from '@/shared/ui/tokens'
import { act, fireEvent, within } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'
import { failed, loaded, pausedOffline, pending, roomFor, renderScreen, type Audience, type QueryLike } from './harness'
import { OFFLINE_SIGNAL_DELAY_MS } from '@/shared/api/queries/use-online-status'

/**
 * The quality gates ask for `screen × audience × state` to actually render —
 * "a selector that only swaps a query param without changing the render is a
 * bug". These tests assert the render differs, not just the input.
 *
 * Every binding a jest.mock factory touches must be `mock`-prefixed; the
 * factories are hoisted above the imports.
 */

// Native ScopedTheme is absent in Jest; retain its children and the app theme context.
jest.spyOn(jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles'), 'ScopedTheme').mockImplementation(({ children }) => <>{children}</>)

const mockPush = jest.fn()
const mockReplace = jest.fn()

const mockIdleMutation = {
  mutate: jest.fn(),
  // The room hub chains off mutateAsync, so it has to resolve, not return void.
  mutateAsync: jest.fn(async () => ({ code: 'ABC123' })),
  isPending: false,
  isError: false,
  error: null,
}

const mockRoom: { query: QueryLike } = { query: loaded(roomFor('couple')) }
// A room id is a UUID in the contract; the lobby refuses anything else (#203).
const mockParams = { roomId: '311f5bd8-f853-4ced-af68-e04398d1451a' }
const mockRoomIds: unknown[] = []
const mockMembers: { query: QueryLike } = { query: loaded([]) }

jest.mock('expo-router', () => ({
  // A screen under test is the one on top; the focus effect is a no-op.
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useNavigationContainerRef: () => ({ isReady: () => true }),
}))

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
// The lobby reads the session status (#199); the real provider pulls in OneSignal.
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))

jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: (id: unknown) => {
    mockRoomIds.push(id)
    return mockRoom.query
  },
  useRoomMembers: () => mockMembers.query,
  // The lobby reads the run and the plan once the room has them (#198); these
  // rooms are still collecting.
  useCurrentSuggestions: () => ({ isPending: false, isError: false, data: undefined, error: null }),
  useCurrentPlan: () => ({ isPending: false, isError: false, data: undefined, error: null }),
  useRoomRealtime: jest.fn(() => ({ status: 'live' })),
  // Inlined rather than pulled from the harness: a jest.mock factory is
  // hoisted, so it can only close over `mock`-prefixed bindings.
  // No stored code and no listed invite: the host sees "Tạo mã mời" (#199).
  useCreateRoomInvite: () => ({ ...mockIdleMutation, stored: null, forget: jest.fn() }),
  useRoomInvites: () => ({ isPending: false, isError: false, isFetching: false, status: 'success', data: [], dataUpdatedAt: 1, refetch: jest.fn() }),
  useRevokeRoomInvite: () => mockIdleMutation,
  useStartMatching: () => mockIdleMutation,
}))

// Imported after the mocks so the screen picks them up.
import GoGoRoomScreen from '@/features/gogo-room/gogo-room.view'

const AUDIENCES: Audience[] = ['couple', 'group-host', 'group-guest']

/** The host-only affordance this screen must never show a member. */
const START_MATCHING = /^Bắt đầu ghép$|^Tìm điểm chung$/i

beforeEach(() => {
  mockParams.roomId = '311f5bd8-f853-4ced-af68-e04398d1451a'
  mockRoomIds.length = 0
  mockRoom.query = loaded(roomFor('couple'))
  mockMembers.query = loaded([])
  mockPush.mockClear()
  mockReplace.mockClear()
})

describe('room hub × state', () => {
  it('renders a loading state, not room content', async () => {
    mockRoom.query = pending()
    const view = await renderScreen(<GoGoRoomScreen />)
    expect(view.toJSON()).not.toBeNull()
    expect(view.queryAllByText(START_MATCHING)).toHaveLength(0)
    expect(view.getAllByTestId('skeleton-block', { includeHiddenElements: true }).length).toBeGreaterThan(0)
    expect(view.queryByTestId('loading-indicator')).toBeNull()
  })

  it('renders an error state with a retry, not a blank screen', async () => {
    mockRoom.query = failed()
    const view = await renderScreen(<GoGoRoomScreen />)
    expect(view.queryAllByText(/Thử lại/).length).toBeGreaterThan(0)
  })

  it('renders room content once loaded, with no retry showing', async () => {
    const view = await renderScreen(<GoGoRoomScreen />)
    expect(view.toJSON()).not.toBeNull()
    expect(view.queryAllByText(/Thử lại/)).toHaveLength(0)
  })

  it('renders a different tree in each state', async () => {
    const trees = new Set<string>()
    for (const state of [pending(), failed(), loaded(roomFor('couple'))]) {
      mockRoom.query = state
      trees.add(JSON.stringify((await renderScreen(<GoGoRoomScreen />)).toJSON(), (key, value) => key === 'refreshControl' ? '[native refresh control]' : value))
    }
    expect(trees.size).toBe(3)
  })
})

describe('room hub × audience', () => {
  it('renders every audience without crashing', async () => {
    for (const audience of AUDIENCES) {
      mockRoom.query = loaded(roomFor(audience, {}, { everyonePicked: true }))
      expect((await renderScreen(<GoGoRoomScreen />)).toJSON()).not.toBeNull()
    }
  })

  it('uses the shared host avatar badge, and the constraints in a card (#295)', async () => {
    mockRoom.query = loaded(roomFor('group-host', {}, { everyonePicked: true }))
    const view = await renderScreen(<GoGoRoomScreen />)
    expect(view.queryByText('Chủ phòng')).toBeNull()
    expect(view.getByTestId('avatar-host-badge')).toBeTruthy()
    const heading = view.getByText('Điều kiện phòng')
    expect(StyleSheet.flatten(heading.props.style)).toMatchObject({ ...type.discoveryHeading, color: text.primary })
  })

  it('gives a member a different screen than a host', async () => {
    mockRoom.query = loaded(roomFor('group-host', {}, { everyonePicked: true }))
    const host = JSON.stringify((await renderScreen(<GoGoRoomScreen />)).toJSON(), (key, value) => key === 'refreshControl' ? '[native refresh control]' : value)

    mockRoom.query = loaded(roomFor('group-guest', {}, { everyonePicked: true }))
    const guest = JSON.stringify((await renderScreen(<GoGoRoomScreen />)).toJSON(), (key, value) => key === 'refreshControl' ? '[native refresh control]' : value)

    expect(host).not.toEqual(guest)
  })

  it('never offers a member the host-only action to start matching', async () => {
    // Same room state as the host case — only the role differs.
    mockRoom.query = loaded(
      roomFor('group-guest', {}, { everyonePicked: true }),
    )
    expect((await renderScreen(<GoGoRoomScreen />)).queryAllByText(START_MATCHING)).toHaveLength(0)
  })

  it('offers the host that action once the room is ready', async () => {
    mockRoom.query = loaded(
      roomFor('group-host', {}, { everyonePicked: true }),
    )
    expect(
      (await renderScreen(<GoGoRoomScreen />)).queryAllByText(START_MATCHING).length,
    ).toBeGreaterThan(0)
  })
})

/**
 * APP-037 (#189) — the budget chip states the unit the room is actually in.
 * A couple room created before the fix holds a per-person amount, and calling
 * that "cho 2 người" would restate a wrong number in friendlier words.
 */
describe('room hub × budget unit', () => {
  it('says per person when that is what the API stored, even for a couple', async () => {
    const room = roomFor('couple')
    mockRoom.query = loaded({
      ...room,
      constraints: { ...room.constraints, budgetMode: 'per_person', budgetAmount: 300_000 },
    })
    const view = await renderScreen(<GoGoRoomScreen />)
    expect(view.getByText(/\/ người/)).toBeTruthy()
    expect(view.queryByText(/cho 2 người/)).toBeNull()
  })

  it('phrases a couple total for two people, not as a group total', async () => {
    const room = roomFor('couple')
    mockRoom.query = loaded({
      ...room,
      constraints: { ...room.constraints, budgetMode: 'total', budgetAmount: 500_000 },
    })
    const view = await renderScreen(<GoGoRoomScreen />)
    expect(view.getByText('500.000đ / cả phòng (2 người)')).toBeTruthy()
    expect(view.queryByText(/tổng nhóm/)).toBeNull()
  })

  it('phrases a group total as a group total', async () => {
    const room = roomFor('group-host')
    mockRoom.query = loaded({
      ...room,
      constraints: { ...room.constraints, budgetMode: 'total', budgetAmount: 1_500_000 },
    })
    const view = await renderScreen(<GoGoRoomScreen />)
    expect(view.getByText('1.500.000đ / cả phòng (4 người)')).toBeTruthy()
  })
})


describe('partial preference capability', () => {
  it('only offers partial matching when the API permits it, and sends explicit acknowledgement', async () => {
    mockRoom.query = loaded(roomFor('group-host', {
      matching: { completedCount: 2, pendingCount: 2, canStart: false, canStartWithIncomplete: true, blockedReason: null },
    }))
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    try {
      const view = await renderScreen(<GoGoRoomScreen />)
      await fireEvent.press(view.getByText('Tiếp tục với lựa chọn hiện có'))
      expect(alert).toHaveBeenCalled()
      const confirm = alert.mock.calls[0][2]?.[1]
      await act(async () => confirm?.onPress?.())
      expect(mockIdleMutation.mutateAsync).toHaveBeenCalledWith({ allowIncompletePreferences: true })
    } finally { alert.mockRestore() }
  })
  it('does not offer partial matching to a member even if capability data is malformed', async () => {
    mockRoom.query = loaded(roomFor('group-guest', {
      matching: { completedCount: 2, pendingCount: 2, canStart: false, canStartWithIncomplete: true, blockedReason: null },
    }))
    const view = await renderScreen(<GoGoRoomScreen />)
    expect(view.queryByText('Tiếp tục với lựa chọn hiện có')).toBeNull()
  })
  it('explains the minimum quorum without offering a bypass', async () => {
    mockRoom.query = loaded(roomFor('group-host', {
      matching: { completedCount: 1, pendingCount: 3, canStart: false, canStartWithIncomplete: false, blockedReason: 'MATCHING_QUORUM_REQUIRED' },
    }))
    const view = await renderScreen(<GoGoRoomScreen />)
    expect(view.getByText('Cần ít nhất 2 người hoàn tất sở thích để bắt đầu ghép.')).toBeTruthy()
    expect(view.queryByText('Tiếp tục với lựa chọn hiện có')).toBeNull()
  })
})

describe('room hub × route param (GoGo-MobileApp#203)', () => {
  it.each(['YDi_00PB1z4FSQZjpLbgdw', 'undefined', 'room-1'])(
    'never asks for a room with %s where the id belongs',
    async junk => {
      mockParams.roomId = junk
      const view = await renderScreen(<GoGoRoomScreen />)
      expect(view.getByText('Link mời không đúng hoặc phòng đã bị xoá.')).toBeTruthy()
      expect(mockRoomIds.length).toBeGreaterThan(0)
      expect(mockRoomIds.every(id => id === undefined)).toBe(true)
      expect(view.queryAllByText(START_MATCHING)).toHaveLength(0)
    },
  )

  it('reads the room when the id is one', async () => {
    await renderScreen(<GoGoRoomScreen />)
    expect(mockRoomIds).toContain('311f5bd8-f853-4ced-af68-e04398d1451a')
  })
})

/**
 * GoGo-MobileApp#253 — a room opened offline that this device never loaded: the
 * paused read used to keep the skeleton on screen forever.
 */
describe('room hub × connectivity', () => {
  const NO_CONNECTION = 'Không có kết nối'

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(async () => {
    await act(async () => {
      onlineManager.setOnline(true)
    })
    jest.useRealTimers()
  })

  it('shows the offline state instead of an endless skeleton when nothing is cached, and keeps loading online', async () => {
    mockRoom.query = pausedOffline()
    const view = await renderScreen(<GoGoRoomScreen />)
    await act(async () => {
      jest.advanceTimersByTime(OFFLINE_SIGNAL_DELAY_MS)
    })
    // Paused while online means the app was only in the background: still loading.
    expect(view.queryByText(NO_CONNECTION)).toBeNull()

    await act(async () => {
      onlineManager.setOnline(false)
      jest.advanceTimersByTime(OFFLINE_SIGNAL_DELAY_MS)
    })
    expect(view.getByText(NO_CONNECTION)).toBeTruthy()
    expect(view.getByLabelText('Quay lại')).toBeTruthy()
    expect(view.queryAllByText(/Thử lại/)).toHaveLength(0)
    expect(view.queryAllByText(START_MATCHING)).toHaveLength(0)

    await act(async () => {
      onlineManager.setOnline(true)
    })
    expect(view.queryByText(NO_CONNECTION)).toBeNull()
  })
})


describe.each(['orange', 'orangeDark'] as const)('595 lobby audience × state render matrix / %s', theme => {
  it.each(AUDIENCES.flatMap(audience => ['default', 'loading', 'empty', 'error'].map(state => [audience, state] as const)))('%s × %s', async (audience, state) => {
    const data = roomFor(audience, state === 'empty' ? { members: [] } : {})
    mockRoom.query = state === 'loading' ? pending() : state === 'error' ? failed() : loaded(data)
    const view = await renderScreen(<ThemeScopeProvider name={theme}><GoGoRoomScreen /></ThemeScopeProvider>)
    if (state === 'loading') expect(view.queryByText('Điều kiện phòng')).toBeNull()
    else if (state === 'error') expect(view.getByText('Thử lại')).toBeTruthy()
    else {
      expect(view.getByText('Điều kiện phòng')).toBeTruthy()
      expect(view.queryAllByText('Tôi')).toHaveLength(state === 'empty' ? 0 : 1)
      if (audience === 'group-guest') {
        expect(view.queryByText('Quản lý phòng')).toBeNull()
        expect(view.queryByText('Tạo mã mời')).toBeNull()
        if (state !== 'empty') {
          expect(data.members!.find(member => member.id === data.myMemberId)).toMatchObject({ role: 'member', isGuest: true })
          const meRow = view.getByText('Tôi').parent!.parent!
          expect(within(meRow).getByText('Khách')).toBeTruthy()
          expect(within(meRow).queryByText('Chủ phòng')).toBeNull()
        }
      }
      if (audience !== 'couple') expect(view.queryByText(/cả hai|cho 2 người/)).toBeNull()
    }
  })
  it('renders every real member in a group larger than a couple', async () => {
    const data = roomFor('group-host')
    mockRoom.query = loaded({ ...data, participantCount: 7, members: Array.from({ length: 7 }, (_, i) => ({ ...data.members![0], id: `p${i}`, displayName: `Member ${i}` })) })
    const view = await renderScreen(<ThemeScopeProvider name={theme}><GoGoRoomScreen /></ThemeScopeProvider>)
    for (let i = 0; i < 5; i++) expect(view.getByText(`Member ${i}`)).toBeTruthy()
    expect(view.queryByText('Member 5')).toBeNull()
    await fireEvent.press(view.getByRole('button', { name: 'Xem tất cả (7)' }))
    for (let i = 0; i < 7; i++) expect(within(view.getByTestId('room-lobby-members-sheet')).getByText(`Member ${i}`)).toBeTruthy()
  })
})


describe('595 F-02 fixed group lobby actions', () => {
  it.each(['orange', 'orangeDark'] as const)('keeps group-host CTA outside long scroll content with a measured inset / %s', async theme => {
    const data = roomFor('group-host', {}, { everyonePicked: true })
    mockRoom.query = loaded({ ...data, participantCount: 30, members: Array.from({ length: 30 }, (_, i) => ({ ...data.members![i % data.members!.length], id: `p${i}`, displayName: `Member ${i}` })) })
    const view = await renderScreen(<ThemeScopeProvider name={theme}><GoGoRoomScreen /></ThemeScopeProvider>)
    const scroll = view.root!.queryAll(node => node.props.contentContainerStyle !== undefined)[0]
    expect(within(scroll).queryByText('Chọn sở thích của bạn')).toBeNull()
    expect(within(scroll).queryAllByText(START_MATCHING)).toHaveLength(0)
    const bar = view.getByTestId('room-lobby-actions')
    expect(within(bar).getByText('Chọn sở thích của bạn')).toBeTruthy()
    expect(within(bar).queryAllByText(START_MATCHING)).toHaveLength(1)
    await fireEvent(bar, 'layout', { nativeEvent: { layout: { height: 240 } } })
    expect(StyleSheet.flatten(view.root!.queryAll(node => node.props.contentContainerStyle !== undefined)[0].props.contentContainerStyle).paddingBottom).toBeGreaterThanOrEqual(240)
    await fireEvent.press(within(bar).getByText('Chọn sở thích của bạn'))
    expect(mockPush).toHaveBeenCalledWith(`/room/${mockParams.roomId}/preference`)
  })
})


it.each(['couple', 'group-guest'] as const)('595 owner sim shared fixed action section for %s', async audience => {
  mockRoom.query = loaded(roomFor(audience))
  const view = await renderScreen(<GoGoRoomScreen />)
  const scroll = view.root!.queryAll(node => node.props.contentContainerStyle !== undefined)[0]
  expect(within(scroll).queryByText('Chọn sở thích của bạn')).toBeNull()
  expect(within(view.getByTestId('room-lobby-actions')).getByText('Chọn sở thích của bạn')).toBeTruthy()
})


describe.each(['orange', 'orangeDark'] as const)('595 owner sim lobby / %s', theme => {
  it.each(AUDIENCES)('removes manage and no-app copy; adds host header share; preserves host edit / %s', async audience => {
    mockRoom.query = loaded(roomFor(audience))
    const view = await renderScreen(<ThemeScopeProvider name={theme}><GoGoRoomScreen /></ThemeScopeProvider>)
    expect(view.queryByRole('button', { name: 'Quản lý phòng' })).toBeNull()
    expect(within(view.getByTestId('room-lobby-header')).queryByRole('button', { name: 'Mời người tham gia' }) !== null).toBe(audience !== 'group-guest')
    expect(view.queryByText(/không cần cài app/)).toBeNull()
    if (audience === 'group-guest') expect(view.queryByRole('button', { name: 'Sửa điều kiện phòng' })).toBeNull()
    else {
      await fireEvent.press(view.getByRole('button', { name: 'Sửa điều kiện phòng' }))
      expect(mockPush).toHaveBeenCalledWith(`/room/${mockParams.roomId}/edit`)
    }
  })

  it.each(['couple', 'group-host'] as const)('places a compact quorum caption beside preferences in the fixed bar / %s', async audience => {
    mockRoom.query = loaded(roomFor(audience, {
      matching: { completedCount: 1, pendingCount: 3, canStart: false, canStartWithIncomplete: false, blockedReason: 'MATCHING_QUORUM_REQUIRED' },
    }))
    const view = await renderScreen(<ThemeScopeProvider name={theme}><GoGoRoomScreen /></ThemeScopeProvider>)
    const scroll = view.root!.queryAll(node => node.props.contentContainerStyle !== undefined)[0]
    expect(within(scroll).queryByText('Chọn sở thích của bạn')).toBeNull()
    const bar = view.getByTestId('room-lobby-actions')
    const hint = within(bar).getByText('Cần ít nhất 2 người hoàn tất sở thích để bắt đầu ghép.')
    const caption = StyleSheet.flatten(hint.props.style)
    expect(caption).toMatchObject({ ...type.caption, color: themes[theme].text.secondary })
    expect(caption.marginBottom ?? 0).toBe(0)
    expect(hint.parent).toBe(within(bar).getByText('Chọn sở thích của bạn').parent!.parent)
    await fireEvent(bar, 'layout', { nativeEvent: { layout: { height: 180 } } })
    expect(StyleSheet.flatten(view.root!.queryAll(node => node.props.contentContainerStyle !== undefined)[0].props.contentContainerStyle).paddingBottom).toBeGreaterThanOrEqual(180)
    await fireEvent.press(within(bar).getByText('Chọn sở thích của bạn'))
    expect(mockPush).toHaveBeenCalledWith(`/room/${mockParams.roomId}/preference`)
  })
})
