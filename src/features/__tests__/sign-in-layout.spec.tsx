import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Dimensions, Keyboard, ScrollView, StyleSheet, View, type KeyboardEvent, type KeyboardEventName } from 'react-native'
import i18n from '@/shared/i18n'

let mockInsets = { top: 20, bottom: 0, left: 0, right: 0 }
const mockSignIn = jest.fn()
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }))
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), canGoBack: () => false }), useLocalSearchParams: () => ({}) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ signIn: mockSignIn, signUp: jest.fn() }) }))
import SignIn from '../auth/sign-in.view'

const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, number | string | undefined>
function scrollAncestor(node: ReturnType<typeof screen.getByText>) {
  let ancestor = node.parent
  while (ancestor && ancestor.type !== 'RCTScrollView') ancestor = ancestor.parent
  return ancestor
}
const original = Dimensions.get('window')
afterEach(async () => { await act(async () => { Dimensions.set({ window: original }) }) })

// This proves the scroll/keyboard contract, not native reachability. No auth
// request, reduced typography, or initial-viewport completeness is required.
it.each([
  { width: 375, height: 667, top: 20, bottom: 0 },
  { width: 393, height: 852, top: 62, bottom: 34 },
  { width: 390, height: 884, top: 47, bottom: 34 },
].flatMap(phone => [1, 1.35].map(fontScale => ({ ...phone, fontScale }))))('S-02/S-03 retains bounded scrolling, full supplementary copy and usable password toggle at $width×$height scale $fontScale', async phone => {
  mockInsets = { top: phone.top, bottom: phone.bottom, left: 0, right: 0 }
  await act(async () => { Dimensions.set({ window: { ...original, width: phone.width, height: phone.height, fontScale: phone.fontScale } }) })
  await render(<SignIn />)
  const password = screen.getByLabelText(i18n.t('auth.password'))
  const scroll = scrollAncestor(password)!
  expect(scroll.type).toBe('RCTScrollView')
  expect(scroll.props.scrollEnabled).not.toBe(false)
  expect(scroll.props.horizontal).not.toBe(true)
  expect(scroll.props.keyboardShouldPersistTaps).toBe('handled')
  expect(flat(scroll.parent!.props.style).flex).toBe(1)
  expect(flat(scroll.props.contentContainerStyle)).toMatchObject({ flexGrow: 1, paddingBottom: phone.bottom + 32 })
  expect(flat(scroll.props.contentContainerStyle).height).toBeUndefined()
  expect(flat(scroll.props.contentContainerStyle).maxHeight).toBeUndefined()
  for (const node of [
    screen.getByLabelText(i18n.t('auth.email')), password,
    screen.getByRole('button', { name: i18n.t('auth.signInCta') }),
    ...(['auth.guestFootnote', 'auth.support', 'auth.curation'] as const).map(key => screen.getByText(i18n.t(key))),
  ]) {
    expect(scrollAncestor(node)).toBe(scroll)
    expect(node.props.allowFontScaling).not.toBe(false)
    expect(node.props.maxFontSizeMultiplier).toBeUndefined()
    expect(node.props.numberOfLines).toBeUndefined()
    let ancestor = node.parent
    while (ancestor && ancestor !== scroll) {
      // The card may round its own background; no fixed height may truncate it.
      expect(flat(ancestor.props.style)?.maxHeight).toBeUndefined()
      ancestor = ancestor.parent
    }
  }
  expect(password.props.secureTextEntry).toBe(true)
  await fireEvent.press(screen.getByTestId('password-visibility'))
  expect(screen.getByLabelText(i18n.t('auth.password')).props.secureTextEntry).toBe(false)
  expect(mockSignIn).not.toHaveBeenCalled()
})

it.each(['vi', 'en'])('renders nationwide copy in both auth modes (%s)', async locale => {
  await act(async () => { await i18n.changeLanguage(locale) })
  await render(<SignIn />)
  for (const mode of ['auth.signInTab', 'auth.signUpTab'] as const) {
    await fireEvent.press(screen.getByRole('tab', { name: i18n.t(mode) }))
    expect(screen.getByText(locale === 'vi' ? 'Cùng bạn bè bình chọn địa điểm ăn uống trên khắp Việt Nam' : 'Vote with friends on places to eat across Vietnam')).toBeTruthy()
    expect(screen.getByText(locale === 'vi' ? 'Địa điểm GoGo tuyển chọn' : 'Curated by GoGo')).toBeTruthy()
  }
  await act(async () => { await i18n.changeLanguage('vi') })
})

it('reveals the password AND all helpers above the keyboard, then respects manual scrolling', async () => {
  let keyboard: ((event: KeyboardEvent) => void) | undefined
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: KeyboardEventName, listener: (event: KeyboardEvent) => void) => {
    if (name === 'keyboardDidShow') keyboard = listener
    return { remove: jest.fn() }
  }) as unknown as typeof Keyboard.addListener)
  const move = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {})
  jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(function (this: { props: { testID?: string } }, callback) {
    if (this.props.testID === 'auth-viewport') callback(0, 100, 393, 650)
    else if (this.props.testID === 'auth-field-password') callback(16, 400, 361, 240)
    else callback(16, 400, 361, 80)
  })
  jest.useFakeTimers()
  await render(<SignIn />)
  await fireEvent.press(screen.getByText(i18n.t('auth.signUpTab')))
  await fireEvent(screen.getByLabelText(i18n.t('auth.password')), 'focus', {})
  await act(async () => { keyboard?.({ endCoordinates: { screenY: 550 } } as KeyboardEvent); jest.runOnlyPendingTimers() })
  // Field 400..640, visible region 100..550, 8-point clearance: reveal 98.
  expect(move).toHaveBeenLastCalledWith(expect.objectContaining({ y: 98 }))
  const scroll = scrollAncestor(screen.getByLabelText(i18n.t('auth.password')))!
  await fireEvent(scroll, 'scrollBeginDrag')
  move.mockClear()
  await fireEvent.changeText(screen.getByLabelText(i18n.t('auth.password')), 'Abcd1!')
  await fireEvent(screen.getByTestId('auth-field-password'), 'layout', {})
  await act(async () => { jest.runOnlyPendingTimers() })
  expect(move).not.toHaveBeenCalled()
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it.each([
  { mode: 'signIn', field: 'password', height: 100, viewportBottom: 750, keyboardTop: 550, expected: 58 },
  { mode: 'signIn', field: 'email', height: 120, viewportBottom: 550, keyboardTop: 550, expected: 78 },
  { mode: 'signUp', field: 'displayName', height: 100, viewportBottom: 750, keyboardTop: 550, expected: 58 },
  { mode: 'signUp', field: 'password', height: 240, viewportBottom: 550, keyboardTop: 550, expected: 198 },
  { mode: 'signUp', field: 'password', height: 80, viewportBottom: 750, keyboardTop: 700, expected: 0 },
])('reveals $mode $field helpers using the smaller viewport/IME bound', async ({ mode, field, height, viewportBottom, keyboardTop, expected }) => {
  const listeners: Partial<Record<KeyboardEventName, (event: KeyboardEvent) => void>> = {}
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: KeyboardEventName, listener: (event: KeyboardEvent) => void) => {
    listeners[name] = listener
    return { remove: jest.fn() }
  }) as unknown as typeof Keyboard.addListener)
  const move = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {})
  jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(function (this: { props: { testID?: string } }, callback) {
    if (this.props.testID === 'auth-viewport') callback(0, 100, 393, viewportBottom - 100)
    else if (this.props.testID === `auth-field-${field}`) callback(16, 500, 361, height)
    else callback(16, 500, 361, 70)
  })
  jest.useFakeTimers()
  await render(<SignIn />)
  if (mode === 'signUp') await fireEvent.press(screen.getByRole('tab', { name: i18n.t('auth.signUpTab') }))
  const input = screen.getByLabelText(i18n.t(`auth.${field}`))
  await fireEvent(input, 'focus', {})
  await act(async () => { listeners.keyboardDidShow?.({ endCoordinates: { screenY: keyboardTop } } as KeyboardEvent); jest.runOnlyPendingTimers() })
  if (expected) expect(move).toHaveBeenLastCalledWith(expect.objectContaining({ y: expected }))
  else expect(move).not.toHaveBeenCalled()
  move.mockClear()
  // A stale measurement must not reveal a field after blur.
  await fireEvent(input, 'blur', {})
  await fireEvent(screen.getByTestId(`auth-field-${field}`), 'layout', {})
  await act(async () => { jest.runOnlyPendingTimers() })
  expect(move).not.toHaveBeenCalled()
  jest.useRealTimers()
  jest.restoreAllMocks()
})
