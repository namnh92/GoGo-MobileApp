import { ThemeScopeProvider } from '@/shared/ui/scoped-theme'
import { act, fireEvent, within } from '@testing-library/react-native'
import { Alert, StyleSheet } from 'react-native'
import { onlineManager } from '@tanstack/react-query'
import { OFFLINE_SIGNAL_DELAY_MS } from '@/shared/api/queries/use-online-status'

import { loaded as mockLoaded, roomFor as mockRoomFor, renderScreen, failed, pending, pausedOffline, type Audience, type QueryLike } from './harness'

/**
 * GoGo-MobileApp#381 — confirmations with consequences used `Alert.alert`: the
 * platform dialog ignores the button family (`button.style.tsx`), draws its
 * destructive action however the OS likes, and cannot be tested by pressing
 * what a person presses. Room confirmations now render the shared ResultSheet.
 */

// Native ScopedTheme is absent in Jest; retain its children and the app theme context.
jest.spyOn(jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles'), 'ScopedTheme').mockImplementation(({ children }) => <>{children}</>)

const mockRoomState: { query: QueryLike } = { query: mockLoaded(mockRoomFor('group-host')) }

let mockConstraintsPending = false
let mockRenamePending = false
const mockUpdateConstraints = jest.fn(async () => mockRoomFor('group-host'))
const mockRename = jest.fn(async (title: string) => ({ ...mockRoomFor('group-host'), title }))
const mockTransition = jest.fn()
const mockRemoveMember = jest.fn()
const mockReplace = jest.fn()
const mockPush = jest.fn()

jest.mock('@/shared/navigation/deep-link', () => ({ ...jest.requireActual('@/shared/navigation/deep-link'), isUuid: () => true }))
jest.mock('expo-router', () => ({
  useNavigationContainerRef: () => ({ isReady: () => true }),
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: 'room-1' }),
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'alice' } }),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoomRealtime: () => ({ status: 'live' }),
  useCurrentSuggestions: () => mockLoaded(undefined),
  useCurrentPlan: () => mockLoaded(undefined),
  useRoom: () => mockRoomState.query,
  useRoomInvites: () => mockLoaded([]),
  useUpdateRoomConstraints: () => ({ mutateAsync: mockUpdateConstraints, isPending: mockConstraintsPending }),
  useRenameRoom: () => ({ mutateAsync: mockRename, isPending: mockRenamePending }),
  useRevokeRoomInvite: () => ({ mutate: jest.fn() }),
  useRemoveRoomMember: () => ({ mutate: mockRemoveMember }),
  useTransitionRoom: () => ({ mutate: mockTransition, isPending: false }),
  useRemoveRoomSeedPlace: () => ({ mutate: jest.fn() }),
}))

import GoGoRoomScreen from '@/features/gogo-room/gogo-room.view'

let alert: jest.SpyInstance
beforeEach(() => {
  mockRoomState.query = mockLoaded(mockRoomFor('group-host'))
  mockConstraintsPending = false
  mockRenamePending = false
  jest.clearAllMocks()
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
})
afterEach(() => alert.mockRestore())

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(element)
  })
}

describe('room management', () => {
  it('confirms cancelling the room in the shared bottom sheet', async () => {
    const view = await renderScreen(<GoGoRoomScreen />)
    await press(view.getByRole('button', { name: 'Huỷ phòng' }))
    expect(alert).not.toHaveBeenCalled()
    expect(view.getByTestId('room-lobby-cancel-confirm')).toBeTruthy()
    expect(view.getByText('Huỷ phòng này?')).toBeTruthy()
    expect(mockTransition).not.toHaveBeenCalled()

    await press(within(view.getByTestId('room-lobby-cancel-confirm')).getByRole('button', { name: 'Huỷ phòng' }))
    expect(mockTransition).toHaveBeenCalledWith({ status: 'cancelled' }, expect.anything())
  })

  it('confirms removing a member by name before removing them', async () => {
    const view = await renderScreen(<GoGoRoomScreen />)
    await press(view.getAllByRole('button', { name: 'Mời Người 1 ra khỏi phòng' })[0])
    expect(alert).not.toHaveBeenCalled()
    expect(view.getByText('Xoá Người 1 khỏi phòng?')).toBeTruthy()
    await press(view.getByRole('button', { name: 'Huỷ' }))
    expect(mockRemoveMember).not.toHaveBeenCalled()
  })
})


describe.each(['orange', 'orangeDark'] as const)('595 manage audience × state matrix / %s', theme => {
  const audiences: Audience[] = ['couple', 'group-host', 'group-guest']
  it.each(audiences.flatMap(audience => ['default', 'loading', 'empty', 'error'].map(state => [audience, state] as const)))('%s × %s', async (audience, state) => {
    mockRoomState.query = state === 'loading' ? pending() : state === 'error' ? failed() : mockLoaded(mockRoomFor(audience, state === 'empty' ? { members: [], seedPlaces: [] } : {}))
    const view = await renderScreen(<ThemeScopeProvider name={theme}><GoGoRoomScreen /></ThemeScopeProvider>)
    if (state === 'loading') {
      expect(view.queryByText('Huỷ phòng')).toBeNull()
      expect(view.getAllByTestId('skeleton-block', { includeHiddenElements: true }).length).toBeGreaterThan(3)
      expect(view.queryByTestId('loading-indicator')).toBeNull()
    }
    else if (state === 'error') expect(view.getByText('Thử lại')).toBeTruthy()
    else if (audience === 'group-guest') {
      expect(view.queryByText('Chỉ chủ phòng')).toBeNull()
      expect(view.getByTestId('room-lobby-seeds')).toBeTruthy()
      expect(view.queryByText('Huỷ phòng')).toBeNull()
      expect(view.queryByText('Sửa')).toBeNull()
    } else {
      expect(view.queryByText('Lưu ý quan trọng')).toBeNull()
      expect(view.queryByText('Chỉ chủ phòng')).toBeNull()
      expect(view.queryByText('Vùng nguy hiểm')).toBeNull()
      expect(view.getByText('Huỷ phòng')).toBeTruthy()
      if (state === 'empty') expect(view.getByText('Chưa ai tham gia.')).toBeTruthy()
      expect(view.queryByLabelText('Tên kèo')).toBeNull()
      await press(view.getByRole('button', { name: 'Sửa' }))
      expect(mockPush).toHaveBeenCalledWith('/room/room-1/edit')
    }
  })
})

describe('room management waits for network', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(async () => {
    await act(async () => onlineManager.setOnline(true))
    jest.useRealTimers()
  })

  it('replaces the layout skeleton with offline state, then restores it on reconnect', async () => {
    mockRoomState.query = pausedOffline()
    const view = await renderScreen(<GoGoRoomScreen />)
    expect(view.getAllByTestId('skeleton-block', { includeHiddenElements: true }).length).toBeGreaterThan(0)
    expect(view.queryByText('Không có kết nối')).toBeNull()

    await act(async () => onlineManager.setOnline(false))
    await act(async () => jest.advanceTimersByTime(OFFLINE_SIGNAL_DELAY_MS))
    expect(view.getByText('Không có kết nối')).toBeTruthy()
    expect(view.queryAllByTestId('skeleton-block', { includeHiddenElements: true })).toHaveLength(0)
    expect(view.queryAllByTestId('skeleton-block', { includeHiddenElements: true })).toHaveLength(0)

    await act(async () => onlineManager.setOnline(true))
    expect(view.queryByText('Không có kết nối')).toBeNull()
    expect(view.getAllByTestId('skeleton-block', { includeHiddenElements: true }).length).toBeGreaterThan(0)
  })
})


it('595 opens the full-screen title editor route from manage', async () => {
  const view = await renderScreen(<GoGoRoomScreen />)
  await press(view.getByRole('button', { name: 'Sửa' }))
  expect(mockPush).toHaveBeenCalledWith('/room/room-1/edit')
  expect(view.queryByLabelText('Tên kèo')).toBeNull()
})

describe.each(['orange', 'orangeDark'] as const)('room confirmation sheets / %s', theme => {
  it('keeps equal-width cancel left and danger right; cancel sends nothing', async () => {
    const view = await renderScreen(<ThemeScopeProvider name={theme}><GoGoRoomScreen /></ThemeScopeProvider>)
    await press(view.getByRole('button', { name: 'Huỷ phòng' }))
    const sheet = view.getByTestId('room-lobby-cancel-confirm')
    const actions = within(sheet).getAllByRole('button').filter(button => ['Huỷ', 'Huỷ phòng'].includes(button.props.accessibilityLabel))
    expect(actions.map(button => button.props.accessibilityLabel)).toEqual(['Huỷ', 'Huỷ phòng'])
    expect(actions.map(button => StyleSheet.flatten(button.props.style).flex)).toEqual([1, 1])
    await press(actions[0])
    expect(view.queryByTestId('room-lobby-cancel-confirm')).toBeNull()
    expect(mockTransition).not.toHaveBeenCalled()
  })
  it.each(['cancel', 'remove'] as const)('keeps %s busy in the sheet, blocks duplicates and shows existing error copy with retry', async kind => {
    const mutation = kind === 'cancel' ? mockTransition : mockRemoveMember
    const view = await renderScreen(<ThemeScopeProvider name={theme}><GoGoRoomScreen /></ThemeScopeProvider>)
    if (kind === 'cancel') await press(view.getByRole('button', { name: 'Huỷ phòng' }))
    else await press(view.getAllByRole('button', { name: 'Mời Người 1 ra khỏi phòng' })[0])
    const label = kind === 'cancel' ? 'Huỷ phòng' : 'Xoá'
    const sheetID = kind === 'cancel' ? 'room-lobby-cancel-confirm' : 'room-lobby-member-confirm'
    const action = () => within(view.getByTestId(sheetID)).getByRole('button', { name: label })
    await press(action()); await press(action())
    expect(mutation).toHaveBeenCalledTimes(1)
    expect(action().props.accessibilityState).toMatchObject({ busy: true, disabled: true })
    expect(view.queryByTestId('blocking-loading-overlay')).toBeNull()
    expect(within(view.getByTestId(sheetID)).getByRole('button', { name: 'Huỷ' })).toBeDisabled()
    const callbacks = mutation.mock.calls[0][1]
    await act(async () => { callbacks.onError(new Error('server')); callbacks.onSettled() })
    expect(view.getByText('Chưa lưu được. Thử lại nhé.')).toBeTruthy()
    expect(action()).toBeEnabled()
    await press(action())
    expect(mutation).toHaveBeenCalledTimes(2)
    if (kind === 'remove') expect(mutation.mock.calls[0][0]).toBe('member-1')
    await act(async () => { mutation.mock.calls[1][1].onSuccess(); mutation.mock.calls[1][1].onSettled() })
    expect(view.queryByTestId(sheetID)).toBeNull()
    if (kind === 'cancel') expect(mockReplace).toHaveBeenCalledWith('/(tabs)/plans')
  })
})
