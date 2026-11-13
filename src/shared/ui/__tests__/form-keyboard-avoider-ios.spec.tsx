import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AppState, DeviceEventEmitter, Keyboard, View } from 'react-native'

jest.unmock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView')
jest.mock('@/features/create-date/wizard-actions.view', () => ({ useWizardActions: jest.fn() }))
import { FormKeyboardAvoider } from '../form-keyboard-avoider.view'
import { WizardHeaderOffset, WizardScreen } from '@/features/create-date/wizard-step.view'

afterEach(() => jest.restoreAllMocks())

it.each([0, 80])('preserves iOS padding, always enabled and offset %s before the keyboard animation', async offset => {
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false)
  const resumed = jest.spyOn(AppState, 'addEventListener')
  await render(<FormKeyboardAvoider testID="avoider" style={{ flex: 1 }} keyboardVerticalOffset={offset}><View /></FormKeyboardAvoider>)
  const host = () => screen.getByTestId('avoider')
  const layout = () => fireEvent(host(), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 764 } } })
  await act(async () => { await layout() })
  await act(async () => {
    DeviceEventEmitter.emit('keyboardWillShow', { duration: 0, easing: 'keyboard', endCoordinates: { screenX: 0, screenY: 500, width: 390, height: 344 } })
  })
  expect(host()).toHaveStyle({ paddingBottom: 264 + offset })
  // Android recovery must not override an iOS will-show before isVisible updates.
  await act(async () => { await layout() })
  expect(host()).toHaveStyle({ paddingBottom: 264 + offset })
  expect(resumed).not.toHaveBeenCalled()
  await act(async () => { DeviceEventEmitter.emit('keyboardWillHide', { duration: 0, easing: 'keyboard', endCoordinates: { screenX: 0, screenY: 844, width: 390, height: 0 } }) })
  expect(host()).toHaveStyle({ paddingBottom: 0 })
})

it('keeps the wizard measured-header offset on iOS', async () => {
  await render(<WizardHeaderOffset.Provider value={80}><WizardScreen step="type" avoidKeyboard><View /></WizardScreen></WizardHeaderOffset.Provider>)
  const host = () => screen.getByTestId('create-type-keyboard')
  await act(async () => {
    await fireEvent(host(), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 764 } } })
    DeviceEventEmitter.emit('keyboardWillShow', { duration: 0, easing: 'keyboard', endCoordinates: { screenX: 0, screenY: 500, width: 390, height: 344 } })
  })
  expect(host()).toHaveStyle({ paddingBottom: 344 })
})
