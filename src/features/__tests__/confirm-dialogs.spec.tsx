import { ThemeScopeProvider } from '@/shared/ui/scoped-theme'
import { act, fireEvent, waitFor, within } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { onlineManager } from '@tanstack/react-query'
import { OFFLINE_SIGNAL_DELAY_MS } from '@/shared/api/queries/use-online-status'

import { loaded as mockLoaded, roomFor as mockRoomFor, renderScreen, failed, pending, pausedOffline, type Audience, type QueryLike } from './harness'

/**
 * GoGo-MobileApp#381 — confirmations with consequences used `Alert.alert`: the
 * platform dialog ignores the button family (`button.style.tsx`), draws its
 * destructive action however the OS likes, and cannot be tested by pressing
 * what a person presses. They render the shared in-app `Dialog` now.
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

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: 'room-1' }),
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'alice' } }),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => mockRoomState.query,
  useRoomInvites: () => mockLoaded([]),
  useUpdateRoomConstraints: () => ({ mutateAsync: mockUpdateConstraints, isPending: mockConstraintsPending }),
  useRenameRoom: () => ({ mutateAsync: mockRename, isPending: mockRenamePending }),
  useRevokeRoomInvite: () => ({ mutate: jest.fn() }),
  useRemoveRoomMember: () => ({ mutate: mockRemoveMember }),
  useTransitionRoom: () => ({ mutate: mockTransition, isPending: false }),
  useRemoveRoomSeedPlace: () => ({ mutate: jest.fn() }),
}))

import { isoToLocalSchedule } from '@/features/gogo-room/room-schedule'
import RoomManageScreen from '@/features/gogo-room/room-manage.view'

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
  it('confirms cancelling the room in an in-app dialog', async () => {
    const view = await renderScreen(<RoomManageScreen />)
    await press(view.getByRole('button', { name: 'Huỷ phòng' }))
    expect(alert).not.toHaveBeenCalled()
    expect(view.getByText('Huỷ phòng này?')).toBeTruthy()
    expect(mockTransition).not.toHaveBeenCalled()

    await press(view.getAllByRole('button', { name: 'Huỷ phòng' }).at(-1)!)
    expect(mockTransition).toHaveBeenCalledWith({ status: 'cancelled' }, expect.anything())
  })

  it('confirms removing a member by name before removing them', async () => {
    const view = await renderScreen(<RoomManageScreen />)
    await press(view.getAllByRole('button', { name: 'Xoá' })[0])
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
    const view = await renderScreen(<ThemeScopeProvider name={theme}><RoomManageScreen /></ThemeScopeProvider>)
    if (state === 'loading') {
      expect(view.queryByText('Huỷ phòng')).toBeNull()
      const loading = view.getByTestId('room-manage-loading')
      expect(loading.props.accessibilityRole).toBe('progressbar')
      expect(loading.props.accessibilityLabel).toBe('Đang tải…')
      expect(within(loading).getAllByTestId('skeleton-block', { includeHiddenElements: true }).length).toBeGreaterThan(3)
      expect(view.queryByTestId('loading-indicator')).toBeNull()
    }
    else if (state === 'error') expect(view.getByText('Thử lại')).toBeTruthy()
    else if (audience === 'group-guest') {
      expect(view.getByText('Chỉ chủ phòng')).toBeTruthy()
      expect(view.queryByText('Huỷ phòng')).toBeNull()
      expect(view.queryByText('Sửa')).toBeNull()
    } else {
      expect(view.queryByText('Lưu ý quan trọng')).toBeNull()
      expect(view.queryByText('Chỉ chủ phòng')).toBeNull()
      expect(view.queryByText('Vùng nguy hiểm')).toBeNull()
      expect(view.getByText('Huỷ phòng')).toBeTruthy()
      if (state === 'empty') expect(view.getByText('Chưa ai tham gia.')).toBeTruthy()
      expect(view.queryByLabelText('Tên kèo')).toBeNull()
      await press(view.getAllByText('Sửa')[0])
      expect(view.getByTestId('room-edit-sheet')).toBeTruthy()
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
    const view = await renderScreen(<RoomManageScreen />)
    expect(view.getByTestId('room-manage-loading')).toBeTruthy()
    expect(view.queryByText('Không có kết nối')).toBeNull()

    await act(async () => onlineManager.setOnline(false))
    await act(async () => jest.advanceTimersByTime(OFFLINE_SIGNAL_DELAY_MS))
    expect(view.getByText('Không có kết nối')).toBeTruthy()
    expect(view.queryByTestId('room-manage-loading')).toBeNull()
    expect(view.queryAllByTestId('skeleton-block', { includeHiddenElements: true })).toHaveLength(0)

    await act(async () => onlineManager.setOnline(true))
    expect(view.queryByText('Không có kết nối')).toBeNull()
    expect(view.getByTestId('room-manage-loading')).toBeTruthy()
  })
})


it('595 opens a title sheet, preserves the rename contract and closes on cancel', async () => {
  const view = await renderScreen(<RoomManageScreen />)
  await press(view.getAllByText('Sửa')[0])
  await fireEvent.changeText(view.getByLabelText('Tên kèo'), '  Nhóm thứ bảy  ')
  await press(view.getByText('Lưu tên'))
  expect(mockRename).toHaveBeenCalledWith('Nhóm thứ bảy')
  await press(view.getByText('Huỷ'))
  expect(view.queryByLabelText('Tên kèo')).toBeNull()
})

it('595 budget sheet uses selected chips and retains version, unit and other constraints', async () => {
  const room = mockRoomFor('group-host', { constraintVersion: 9 })
  mockRoomState.query = mockLoaded(room)
  const view = await renderScreen(<RoomManageScreen />)
  await press(view.getAllByText('Sửa')[2])
  const options = view.getAllByRole('button').filter(node => node.props.accessibilityState?.selected === false)
  expect(options.length).toBeGreaterThan(0)
  await press(options[0])
  expect(view.getAllByRole('button').some(node => node.props.accessibilityState?.selected === true)).toBe(true)
  await press(view.getByText('Lưu'))
  await press(view.getByRole('button', { name: 'Xác nhận' }))
  expect(mockUpdateConstraints).toHaveBeenCalledWith(expect.objectContaining({ expectedConstraintVersion: 9, budgetMode: room.constraints!.budgetMode, currency: room.constraints!.currency }))
})


describe('595 F-01 budget sheet pending', () => {
  it('blocks inside the sheet modal and disables every budget chip until A completes', async () => {
    let complete!: (value: ReturnType<typeof mockRoomFor>) => void
    mockUpdateConstraints.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    const view = await renderScreen(<RoomManageScreen />)
    await press(view.getAllByText('Sửa')[2])
    const choices = view.getAllByRole('button').filter(node => node.props.accessibilityState?.selected === false)
    await press(choices[0])
    const choiceA = choices[0].props.accessibilityLabel
    await press(view.getByText('Lưu'))
    await press(view.getByRole('button', { name: 'Xác nhận' }))
    expect(mockUpdateConstraints).toHaveBeenCalledWith(expect.objectContaining({ budgetAmount: 500_000 }))
    mockConstraintsPending = true
    await view.rerender(<RoomManageScreen />)
    const sheetModal = view.getByTestId('room-edit-sheet-modal')
    expect(within(sheetModal).getByTestId('blocking-loading-overlay')).toBeTruthy()
    const chips = within(sheetModal).getAllByRole('button', { includeHiddenElements: true }).filter(node => typeof node.props.accessibilityState?.selected === 'boolean')
    expect(chips.length).toBeGreaterThan(1)
    for (const chip of chips) expect(chip.props.accessibilityState.disabled).toBe(true)
    await press(chips.find(node => node.props.accessibilityState.selected === false)!)
    expect(chips.find(node => node.props.accessibilityLabel === choiceA)!.props.accessibilityState.selected).toBe(true)
    await act(async () => complete(mockRoomFor('group-host')))
    mockConstraintsPending = false
    await view.rerender(<RoomManageScreen />)
    expect(view.getByTestId('room-edit-sheet')).toBeTruthy()
    await press(view.getByText('Huỷ'))
    expect(view.queryByTestId('room-edit-sheet')).toBeNull()
  })

  it.each(['header', 'backdrop', 'android-back', 'escape', 'cancel'])('ignores %s close while pending', async path => {
    const view = await renderScreen(<RoomManageScreen />)
    await press(view.getAllByText('Sửa')[2])
    mockConstraintsPending = true
    await view.rerender(<RoomManageScreen />)
    if (path === 'header') await press(view.getAllByLabelText('Quay lại', { includeHiddenElements: true }).at(-1)!)
    if (path === 'backdrop') await press(view.getByLabelText('Đóng', { includeHiddenElements: true }))
    if (path === 'android-back') await fireEvent(view.getByTestId('room-edit-sheet-modal'), 'requestClose')
    if (path === 'escape') await fireEvent(view.getByTestId('room-edit-sheet'), 'accessibilityEscape')
    if (path === 'cancel') await press(view.getByText('Huỷ', { includeHiddenElements: true }))
    expect(view.getByTestId('room-edit-sheet')).toBeTruthy()
  })
})


const scheduledConstraints = {
  ...mockRoomFor('group-host').constraints!,
  startAt: '2026-11-14T11:30:00Z', endAt: '2026-11-14T15:00:00Z',
}

describe.each(['orange', 'orangeDark'] as const)('595 combined manage sheet / %s', theme => {
  it.each((['couple', 'group-host', 'group-guest'] as const).flatMap(audience =>
    (['default', 'empty', 'pending-title', 'pending-schedule', 'error-title', 'error-schedule'] as const).map(state => [audience, state] as const),
  ))('%s × %s', async (audience, state) => {
    const room = mockRoomFor(audience, {
      title: state === 'empty' ? undefined : 'Tên cũ', constraintVersion: 9,
      constraints: state === 'empty' ? mockRoomFor(audience).constraints : scheduledConstraints,
    })
    mockRoomState.query = mockLoaded(room)
    const element = () => <ThemeScopeProvider name={theme}><RoomManageScreen /></ThemeScopeProvider>
    const view = await renderScreen(element())
    if (audience === 'group-guest') {
      expect(view.getByText('Chỉ chủ phòng')).toBeTruthy()
      expect(view.queryByText('Sửa')).toBeNull()
      expect(mockRename).not.toHaveBeenCalled()
      expect(mockUpdateConstraints).not.toHaveBeenCalled()
      return
    }
    // Both management rows open the same sheet containing both real editors.
    await press(view.getAllByRole('button', { name: 'Sửa' }).find(node => node.props.accessibilityHint === (state === 'default' ? 'Ngày giờ kèo' : 'Tên kèo'))!)
    expect(view.getAllByTestId('room-edit-sheet')).toHaveLength(1)
    expect(view.getByLabelText('Tên kèo').props.value).toBe(state === 'empty' ? '' : 'Tên cũ')
    expect(view.getByLabelText('Bắt đầu').props.value).toBe(state === 'empty' ? '' : isoToLocalSchedule(scheduledConstraints.startAt))
    expect(view.getByLabelText('Kết thúc (không bắt buộc)').props.value).toBe(state === 'empty' ? '' : isoToLocalSchedule(scheduledConstraints.endAt))
    if (state.startsWith('pending')) {
      mockRenamePending = state === 'pending-title'
      mockConstraintsPending = state === 'pending-schedule'
      await view.rerender(element())
      expect(view.getByLabelText('Tên kèo', { includeHiddenElements: true }).props.editable).toBe(false)
      expect(view.getByLabelText('Bắt đầu', { includeHiddenElements: true }).props.editable).toBe(false)
      const modal = view.getByTestId('room-edit-sheet-modal')
      expect(within(modal).getByTestId('blocking-loading-overlay')).toBeTruthy()
      await press(view.getAllByLabelText('Quay lại', { includeHiddenElements: true }).at(-1)!)
      await press(view.getByLabelText('Đóng', { includeHiddenElements: true }))
      await fireEvent(modal, 'requestClose')
      await fireEvent(view.getByTestId('room-edit-sheet'), 'accessibilityEscape')
      await press(view.getByText('Huỷ', { includeHiddenElements: true }))
      expect(view.getByTestId('room-edit-sheet')).toBeTruthy()
      expect(mockRename).not.toHaveBeenCalled()
      expect(mockUpdateConstraints).not.toHaveBeenCalled()
    } else if (state.startsWith('error')) {
      if (state === 'error-title') {
        mockRename.mockRejectedValueOnce(new Error('offline'))
        await fireEvent.changeText(view.getByLabelText('Tên kèo'), 'Tên mới')
        await press(view.getByText('Lưu tên'))
        expect(mockUpdateConstraints).not.toHaveBeenCalled()
      } else {
        mockUpdateConstraints.mockRejectedValueOnce(new Error('offline'))
        await fireEvent.changeText(view.getByLabelText('Bắt đầu'), isoToLocalSchedule('2026-11-14T12:00:00Z'))
        await press(view.getByRole('button', { name: 'Xác nhận' }))
        await press(view.getAllByRole('button', { name: 'Xác nhận' }).at(-1)!)
        expect(mockRename).not.toHaveBeenCalled()
      }
      expect(await view.findByText('Chưa lưu được. Thử lại nhé.')).toBeTruthy()
      expect(view.getByTestId('room-edit-sheet')).toBeTruthy()
    }
  })

  it('saves name and schedule independently through the existing handlers and validates each form', async () => {
    const room = mockRoomFor('group-host', { title: 'Tên cũ', constraintVersion: 9, constraints: scheduledConstraints })
    mockRoomState.query = mockLoaded(room)
    const view = await renderScreen(<ThemeScopeProvider name={theme}><RoomManageScreen /></ThemeScopeProvider>)
    await press(view.getAllByText('Sửa')[0])
    await fireEvent.changeText(view.getByLabelText('Tên kèo'), '  Nhóm thứ bảy  ')
    await fireEvent.changeText(view.getByLabelText('Bắt đầu'), isoToLocalSchedule('2026-11-14T12:00:00Z'))
    await fireEvent.changeText(view.getByLabelText('Kết thúc (không bắt buộc)'), '')
    await press(view.getByText('Lưu tên'))
    await waitFor(() => expect(mockRename).toHaveBeenCalledWith('Nhóm thứ bảy'))
    expect(mockUpdateConstraints).not.toHaveBeenCalled()
    expect(view.getByLabelText('Bắt đầu').props.value).toBe(isoToLocalSchedule('2026-11-14T12:00:00Z'))
    await press(view.getByRole('button', { name: 'Xác nhận' }))
    await press(view.getAllByRole('button', { name: 'Xác nhận' }).at(-1)!)
    await waitFor(() => expect(mockUpdateConstraints).toHaveBeenCalledWith({
      ...scheduledConstraints, startAt: '2026-11-14T12:00:00.000Z', endAt: null, expectedConstraintVersion: 9,
    }))
    expect(mockRename).toHaveBeenCalledTimes(1)
    await fireEvent.changeText(view.getByLabelText('Tên kèo'), 'x'.repeat(81))
    await press(view.getByText('Lưu tên'))
    expect(await view.findByText('Tên kèo tối đa 80 ký tự.')).toBeTruthy()
    expect(mockRename).toHaveBeenCalledTimes(1)
    await fireEvent.changeText(view.getByLabelText('Bắt đầu'), 'invalid')
    await press(view.getByRole('button', { name: 'Xác nhận' }))
    expect(await view.findByText(/Kiểm tra ngày giờ hợp lệ/)).toBeTruthy()
    expect(mockUpdateConstraints).toHaveBeenCalledTimes(1)
    await press(view.getByText('Huỷ'))
    expect(view.queryByLabelText('Tên kèo')).toBeNull()
    expect(view.queryByLabelText('Bắt đầu')).toBeNull()
  })
})
