import { fireEvent } from '@testing-library/react-native'
import { renderScreen } from './harness'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'user-1' } }) }))
import GroupSetupScreen from '@/features/create-date/group-setup.view'
import CreateTypeScreen from '@/features/create-date/create-type.view'
import { toCreateRoomBody, useRoomStore } from '@/shared/store/roomStore'

it('keeps an optional room name across navigation and sends it trimmed', async () => {
  useRoomStore.getState().resetDraft()
  const view = await renderScreen(<CreateTypeScreen />)
  await fireEvent.changeText(view.getByLabelText('Tên kèo (không bắt buộc)'), '  Hẹn cuối tuần  ')
  expect(toCreateRoomBody(useRoomStore.getState()).title).toBe('Hẹn cuối tuần')
  await fireEvent.press(view.getByText('Tiếp tục'))
  expect(mockPush).toHaveBeenCalledWith('/create/location')
})

it('retains the 80-character contract and selected group route (#594)', async () => {
  useRoomStore.getState().resetDraft()
  const view = await renderScreen(<CreateTypeScreen />)
  expect(view.getByLabelText('Tên kèo (không bắt buộc)').props.maxLength).toBe(80)
  await fireEvent.press(view.getByText('Nhóm bạn'))
  expect(view.getAllByRole('radio').map(option => option.props.accessibilityState.selected)).toEqual([false, true])
  expect(view.getByText('Bước 1 / 6')).toBeTruthy()
  await fireEvent.press(view.getByText('Tiếp tục'))
  expect(mockPush).toHaveBeenCalledWith('/create/group-setup')
})

it('the exact counter stays within the existing 3–12 limit', async () => {
  useRoomStore.getState().resetDraft()
  useRoomStore.getState().setAudience('group-host')
  const view = await renderScreen(<GroupSetupScreen />)
  for (let count = useRoomStore.getState().participantCount; count < 12; count++) await fireEvent.press(view.getByRole('button', { name: 'Thêm một người' }))
  expect(useRoomStore.getState().participantCount).toBe(12)
  expect(view.getByRole('button', { name: 'Thêm một người' }).props.accessibilityState.disabled).toBe(true)
  for (let count = 12; count > 3; count--) await fireEvent.press(view.getByRole('button', { name: 'Bớt một người' }))
  expect(useRoomStore.getState().participantCount).toBe(3)
  expect(view.getByRole('button', { name: 'Bớt một người' }).props.accessibilityState.disabled).toBe(true)
})
