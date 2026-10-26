import { act, fireEvent } from '@testing-library/react-native'
import { Alert } from 'react-native'

import { loaded as mockLoaded, roomFor as mockRoomFor, renderScreen } from './harness'

/**
 * GoGo-MobileApp#381 — confirmations with consequences used `Alert.alert`: the
 * platform dialog ignores the button family (`button.style.tsx`), draws its
 * destructive action however the OS likes, and cannot be tested by pressing
 * what a person presses. They render the shared in-app `Dialog` now.
 */

const mockClearDraft = jest.fn(async () => undefined)
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
  useRoom: () => mockLoaded(mockRoomFor('group-host')),
  useRoomInvites: () => mockLoaded([]),
  useUpdateRoomConstraints: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRevokeRoomInvite: () => ({ mutate: jest.fn() }),
  useRemoveRoomMember: () => ({ mutate: mockRemoveMember }),
  useTransitionRoom: () => ({ mutate: mockTransition, isPending: false }),
  useRemoveRoomSeedPlace: () => ({ mutate: jest.fn() }),
}))
jest.mock('@/features/gogo-room/room-schedule-editor.view', () => ({ RoomScheduleEditor: () => null }))
jest.mock('@/features/gogo-room/room-title-editor.view', () => ({ RoomTitleEditor: () => null }))

import { DraftResume } from '@/features/create-date/draft-resume.view'
import RoomManageScreen from '@/features/gogo-room/room-manage.view'

let alert: jest.SpyInstance
beforeEach(() => {
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
