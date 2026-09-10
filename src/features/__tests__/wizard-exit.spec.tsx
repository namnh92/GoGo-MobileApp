import { act, fireEvent, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { renderScreen } from './harness'
const mockDismiss = jest.fn()
const mockSave = jest.fn(async (_owner: string, _step: string) => undefined)
const mockClear = jest.fn(async () => undefined)
jest.mock('expo-router', () => ({ useRouter: () => ({ dismissTo: mockDismiss }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ session: { kind: 'user', userId: 'alice' } }) }))
jest.mock('@/shared/store/savedRoomDraft', () => ({ saveRoomDraft: (owner: string, step: string) => mockSave(owner, step), clearSavedRoomDraft: () => mockClear() }))
import { WizardActions } from '@/features/create-date/wizard-actions.view'
import { useRoomStore } from '@/shared/store/roomStore'

beforeEach(() => { jest.clearAllMocks(); useRoomStore.getState().resetDraft() })

it('exits an untouched wizard straight to Home', async () => {
  const view = await renderScreen(<WizardActions step="type" />)
  await fireEvent.press(view.getByText('Đóng'))
  expect(mockDismiss).toHaveBeenCalledWith('/(tabs)')
})

it('offers save/discard/continue and saves the current step before leaving', async () => {
  useRoomStore.getState().patchDraft({ title: 'Cuối tuần' })
  const alert = jest.spyOn(Alert, 'alert')
  const view = await renderScreen(<WizardActions step="budget" />)
  await fireEvent.press(view.getByText('Đóng'))
  expect(mockDismiss).not.toHaveBeenCalled()
  const options = alert.mock.calls.at(-1)![2]!
  expect(options.map(option => option.text)).toEqual(['Tiếp tục sửa', 'Bỏ bản nháp', 'Lưu nháp và thoát'])
  await act(async () => { options[2].onPress?.() })
  await waitFor(() => expect(mockDismiss).toHaveBeenCalledWith('/(tabs)'))
  expect(mockSave).toHaveBeenCalledWith('alice', 'budget')
  alert.mockRestore()
})
