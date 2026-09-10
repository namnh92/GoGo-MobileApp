import { fireEvent } from '@testing-library/react-native'
import { renderScreen } from './harness'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'user-1' } }) }))
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
