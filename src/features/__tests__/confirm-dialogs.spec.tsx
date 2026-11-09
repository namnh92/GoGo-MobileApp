import { ThemeScopeProvider } from '@/shared/ui/scoped-theme'
import { act, fireEvent } from '@testing-library/react-native'
import { Alert } from 'react-native'

import { loaded as mockLoaded, roomFor as mockRoomFor, renderScreen, failed, pending, type Audience, type QueryLike } from './harness'

/**
 * GoGo-MobileApp#381 — confirmations with consequences used `Alert.alert`: the
 * platform dialog ignores the button family (`button.style.tsx`), draws its
 * destructive action however the OS likes, and cannot be tested by pressing
 * what a person presses. They render the shared in-app `Dialog` now.
 */

// Native ScopedTheme is absent in Jest; retain its children and the app theme context.
jest.spyOn(jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles'), 'ScopedTheme').mockImplementation(({ children }) => <>{children}</>)

const mockRoomState: { query: QueryLike } = { query: mockLoaded(mockRoomFor('group-host')) }

const mockClearDraft = jest.fn(async () => undefined)
const mockUpdateConstraints = jest.fn(async () => mockRoomFor('group-host'))
const mockRename = jest.fn(async (title: string) => ({ ...mockRoomFor('group-host'), title }))
const mockTransition = jest.fn()
const mockRemoveMember = jest.fn()
const mockReplace = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: 'room-1' }),
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'alice' } }),
}))
jest.mock('@/shared/store/savedRoomDraft', () => {
  const draft = { draft: { ownerId: 'alice', step: 'budget' } }
  return {
    useSavedRoomDraft: (select: (state: typeof draft) => unknown) => select(draft),
    clearSavedRoomDraft: () => mockClearDraft(),
    restoreRoomDraft: () => null,
    draftStepPath: () => [],
  }
})
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => mockRoomState.query,
  useRoomInvites: () => mockLoaded([]),
  useUpdateRoomConstraints: () => ({ mutateAsync: mockUpdateConstraints, isPending: false }),
  useRenameRoom: () => ({ mutateAsync: mockRename, isPending: false }),
  useRevokeRoomInvite: () => ({ mutate: jest.fn() }),
  useRemoveRoomMember: () => ({ mutate: mockRemoveMember }),
  useTransitionRoom: () => ({ mutate: mockTransition, isPending: false }),
  useRemoveRoomSeedPlace: () => ({ mutate: jest.fn() }),
}))

import { DraftResume } from '@/features/create-date/draft-resume.view'
import RoomManageScreen from '@/features/gogo-room/room-manage.view'

let alert: jest.SpyInstance
beforeEach(() => {
  mockRoomState.query = mockLoaded(mockRoomFor('group-host'))
  jest.clearAllMocks()
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
})
afterEach(() => alert.mockRestore())

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(element)
  })
}

describe('delete a saved draft', () => {
  it('asks in an in-app dialog and deletes only on the destructive button', async () => {
    const view = await renderScreen(<DraftResume />)
    await press(view.getByRole('button', { name: 'Xóa nháp' }))
    expect(alert).not.toHaveBeenCalled()
    expect(view.getByRole('header', { name: 'Xóa nháp' })).toBeTruthy()
    expect(mockClearDraft).not.toHaveBeenCalled()

    await press(view.getAllByRole('button', { name: 'Xóa nháp' }).at(-1)!)
    expect(mockClearDraft).toHaveBeenCalledTimes(1)
    expect(view.queryByRole('header', { name: 'Xóa nháp' })).toBeNull()
  })

  it('keeps the draft when cancelled', async () => {
    const view = await renderScreen(<DraftResume />)
    await press(view.getByRole('button', { name: 'Xóa nháp' }))
    await press(view.getByRole('button', { name: 'Huỷ' }))
    expect(mockClearDraft).not.toHaveBeenCalled()
    expect(view.queryByRole('header', { name: 'Xóa nháp' })).toBeNull()
  })
})

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
    if (state === 'loading') expect(view.queryByText('Huỷ phòng')).toBeNull()
    else if (state === 'error') expect(view.getByText('Thử lại')).toBeTruthy()
    else if (audience === 'group-guest') {
      expect(view.getByText('Chỉ chủ phòng')).toBeTruthy()
      expect(view.queryByText('Huỷ phòng')).toBeNull()
      expect(view.queryByText('Sửa')).toBeNull()
    } else {
      expect(view.getByText('Lưu ý quan trọng')).toBeTruthy()
      expect(view.getByText('Huỷ phòng')).toBeTruthy()
      if (state === 'empty') expect(view.getByText('Chưa ai tham gia.')).toBeTruthy()
      expect(view.queryByLabelText('Tên kèo')).toBeNull()
      await fireEvent.press(view.getAllByText('Sửa')[0])
      expect(view.getByTestId('room-edit-sheet')).toBeTruthy()
    }
  })
})


it('595 opens a title sheet, preserves the rename contract and closes on cancel', async () => {
  const view = await renderScreen(<RoomManageScreen />)
  await fireEvent.press(view.getAllByText('Sửa')[0])
  await fireEvent.changeText(view.getByLabelText('Tên kèo'), '  Nhóm thứ bảy  ')
  await fireEvent.press(view.getByText('Lưu'))
  expect(mockRename).toHaveBeenCalledWith('Nhóm thứ bảy')
  await fireEvent.press(view.getByText('Huỷ'))
  expect(view.queryByLabelText('Tên kèo')).toBeNull()
})

it('595 budget sheet uses selected chips and retains version, unit and other constraints', async () => {
  const room = mockRoomFor('group-host', { constraintVersion: 9 })
  mockRoomState.query = mockLoaded(room)
  const view = await renderScreen(<RoomManageScreen />)
  await fireEvent.press(view.getAllByText('Sửa')[2])
  const options = view.getAllByRole('button').filter(node => node.props.accessibilityState?.selected === false)
  expect(options.length).toBeGreaterThan(0)
  await fireEvent.press(options[0])
  expect(view.getAllByRole('button').some(node => node.props.accessibilityState?.selected === true)).toBe(true)
  await fireEvent.press(view.getByText('Lưu'))
  expect(mockUpdateConstraints).toHaveBeenCalledWith(expect.objectContaining({ expectedConstraintVersion: 9, budgetMode: room.constraints!.budgetMode, currency: room.constraints!.currency }))
})
