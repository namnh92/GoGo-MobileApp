import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AppState, DeviceEventEmitter, Keyboard, type AppStateStatus } from 'react-native'
import i18n from '@/shared/i18n'

jest.unmock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView')
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: { OS: 'android', select: (values: Record<string, unknown>) => values.android ?? values.native ?? values.default },
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), canGoBack: () => false }), useLocalSearchParams: () => ({}) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ signIn: jest.fn(), signUp: jest.fn() }) }))
import SignIn from '../auth/sign-in.view'

const event = (screenY: number, height: number) => ({ duration: 0, easing: 'keyboard', endCoordinates: { screenX: 0, screenY, width: 390, height } })
afterEach(() => jest.restoreAllMocks())

it.each(['signIn', 'signUp'])('keeps %s fields and CTA in a scrollable viewport above Android IME and restores it exactly', async mode => {
  const visible = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false)
  await render(<SignIn />)
  if (mode === 'signUp') await fireEvent.press(screen.getByRole('tab', { name: i18n.t('auth.signUpTab') }))
  const host = () => screen.getByTestId('auth-viewport').parent!
  const layout = () => fireEvent(host(), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 100, width: 390, height: 744 } } })
  await act(async () => { await layout() })
  const baseline = host().props.style
  let scroll = screen.getByLabelText(i18n.t('auth.password')).parent!
  while (scroll.type !== 'RCTScrollView') scroll = scroll.parent!
  expect(scroll.props.keyboardShouldPersistTaps).toBe('handled')
  let buttonAncestor = screen.getByRole('button', { name: i18n.t(mode === 'signUp' ? 'auth.signUpCta' : 'auth.signInCta') }).parent
  while (buttonAncestor && buttonAncestor !== scroll) buttonAncestor = buttonAncestor.parent
  expect(buttonAncestor).toBe(scroll)
  for (const top of [500, 460]) {
    await act(async () => { visible.mockReturnValue(true); DeviceEventEmitter.emit('keyboardDidShow', event(top, 844 - top)) })
    expect(host()).toHaveStyle({ flex: 1, paddingBottom: 844 - top })
    await act(async () => { visible.mockReturnValue(false); DeviceEventEmitter.emit('keyboardDidHide', event(820, 0)) })
    expect(host().props.style).toEqual(baseline)
    await act(async () => { await layout() })
    expect(host().props.style).toEqual(baseline)
  }
})

it('sign-in recovers a missed hide on AppState active', async () => {
  const visible = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false)
  const listeners: ((state: AppStateStatus) => void)[] = []
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { listeners.push(listener); return { remove: jest.fn() } })
  await render(<SignIn />)
  const host = () => screen.getByTestId('auth-viewport').parent!
  await act(async () => {
    await fireEvent(host(), 'layout', { persist: () => {}, nativeEvent: { layout: { x: 0, y: 100, width: 390, height: 744 } } })
    visible.mockReturnValue(true)
    DeviceEventEmitter.emit('keyboardDidShow', event(500, 344))
  })
  expect(host()).toHaveStyle({ paddingBottom: 344 })
  await act(async () => { visible.mockReturnValue(false); listeners.forEach(listener => listener('active')) })
  expect(host()).toHaveStyle({ paddingBottom: 0 })
})
