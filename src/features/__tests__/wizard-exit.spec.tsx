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

// #381: the in-app Dialog, not the platform alert — its buttons follow the
// button family and the screen reader reads it as one modal unit.
it('offers save/discard/continue and saves the current step before leaving', async () => {
  useRoomStore.getState().patchDraft({ title: 'Cuối tuần' })
  const alert = jest.spyOn(Alert, 'alert')
  const view = await renderScreen(<WizardActions step="budget" />)
  await fireEvent.press(view.getByText('Đóng'))
  expect(mockDismiss).not.toHaveBeenCalled()
  expect(alert).not.toHaveBeenCalled()
  expect(view.getByText('Thoát tạo kèo?')).toBeTruthy()
  for (const label of ['Tiếp tục sửa', 'Bỏ bản nháp', 'Lưu nháp và thoát']) {
    expect(view.getByRole('button', { name: label })).toBeTruthy()
  }
  await act(async () => { await fireEvent.press(view.getByRole('button', { name: 'Lưu nháp và thoát' })) })
  await waitFor(() => expect(mockDismiss).toHaveBeenCalledWith('/(tabs)'))
  expect(mockSave).toHaveBeenCalledWith('alice', 'budget')
  alert.mockRestore()
})

it('keeps editing when the dialog is cancelled', async () => {
  useRoomStore.getState().patchDraft({ title: 'Cuối tuần' })
  const view = await renderScreen(<WizardActions step="budget" />)
  await fireEvent.press(view.getByText('Đóng'))
  await act(async () => { await fireEvent.press(view.getByRole('button', { name: 'Tiếp tục sửa' })) })
  expect(view.queryByText('Thoát tạo kèo?')).toBeNull()
  expect(mockDismiss).not.toHaveBeenCalled()
  expect(mockSave).not.toHaveBeenCalled()
  expect(mockClear).not.toHaveBeenCalled()
})

it('discards the saved draft and resets the in-progress room', async () => {
  useRoomStore.getState().patchDraft({ title: 'Cuối tuần' })
  const view = await renderScreen(<WizardActions step="mood" />)
  await fireEvent.press(view.getByText('Đóng'))
  expect(view.getByTestId('wizard-exit-prompt')).toBeTruthy()
  expect(view.getByTestId('sheet-actions')).toBeTruthy()
  await act(async () => { await fireEvent.press(view.getByRole('button', { name: 'Bỏ bản nháp' })) })
  await waitFor(() => expect(mockDismiss).toHaveBeenCalledWith('/(tabs)'))
  expect(mockClear).toHaveBeenCalledTimes(1)
  expect(useRoomStore.getState().title).toBe('')
  expect(mockSave).not.toHaveBeenCalled()
})
