import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AppState, DeviceEventEmitter, Keyboard, View, type AppStateStatus } from 'react-native'

jest.unmock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView')
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: { OS: 'android', select: (values: Record<string, unknown>) => values.android ?? values.native ?? values.default },
}))
import { FormKeyboardAvoider } from '../form-keyboard-avoider.view'

const event = (screenY: number, height: number) => ({ duration: 0, easing: 'keyboard', endCoordinates: { screenX: 0, screenY, width: 390, height } })
afterEach(() => jest.restoreAllMocks())

it.each(['hide', 'resume', 'layout'] as const)('avoids on show and restores on %s, including late layout and repeated cycles', async trigger => {
  const visible = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false)
  const listeners: ((state: AppStateStatus) => void)[] = []
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { listeners.push(listener); return { remove: jest.fn() } })
  const onLayout = jest.fn()
  // A header offset is still applied on Android, as in the existing wizard.
  await render(<FormKeyboardAvoider testID="avoider" style={{ flex: 1 }} keyboardVerticalOffset={80} onLayout={onLayout}><View /></FormKeyboardAvoider>)
  const host = () => screen.getByTestId('avoider')
  const layout = () => fireEvent(host(), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 764 } } })
  await act(async () => { await layout() })
  const baseline = host().props.style
  for (const top of [500, 460]) {
    await act(async () => { visible.mockReturnValue(true); DeviceEventEmitter.emit('keyboardDidShow', event(top, 844 - top)) })
    expect(host()).toHaveStyle({ flex: 1, paddingBottom: 844 - top })
    await act(async () => { await layout() })
    expect(host()).toHaveStyle({ paddingBottom: 844 - top })
    await act(async () => {
      visible.mockReturnValue(false)
      if (trigger === 'hide') DeviceEventEmitter.emit('keyboardDidHide', event(820, 0))
      if (trigger === 'resume') { listeners.forEach(listener => listener('background')); listeners.forEach(listener => listener('active')) }
      if (trigger === 'layout') await layout()
    })
    expect(host().props.style).toEqual(baseline)
    await act(async () => { await layout() })
    expect(host().props.style).toEqual(baseline)
  }
  expect(onLayout).toHaveBeenCalled()
})
