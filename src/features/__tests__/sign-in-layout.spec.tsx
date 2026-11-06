import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Dimensions, StyleSheet } from 'react-native'
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
