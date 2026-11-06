import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Keyboard, TextInput } from 'react-native'
import i18n from '@/shared/i18n'

// Exercise RN's real responder policy, rather than the preset's prop-only mock.
jest.unmock('react-native/Libraries/Components/ScrollView/ScrollView')
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), canGoBack: () => false }), useLocalSearchParams: () => ({}) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ signIn: jest.fn(), signUp: jest.fn() }) }))
import SignIn from '../auth/sign-in.view'

it.each(['signIn', 'signUp'])('dismisses on an empty-space tap while preserving button taps in %s', async mode => {
  const state = jest.requireActual<{ default: {
    registerInput: (input: object) => void; unregisterInput: (input: object) => void
    focusInput: (input: object) => void; blurInput: (input: object) => void
    blurTextInput: (input: object) => void
  } }>('react-native/Libraries/Components/TextInput/TextInputState').default
  const focused = {}
  state.registerInput(focused)
  state.focusInput(focused)
  // Replace only the native blur command; retain the focus-state transition.
  const blur = jest.spyOn(state, 'blurTextInput').mockImplementation(input => state.blurInput(input))
  jest.spyOn(Keyboard, 'metrics').mockReturnValue({ screenX: 0, screenY: 550, width: 393, height: 302 })
  try {
    await render(<SignIn />)
    if (mode === 'signUp') await fireEvent.press(screen.getByRole('tab', { name: i18n.t('auth.signUpTab') }))
    await fireEvent(screen.getByLabelText(i18n.t('auth.password')), 'focus', {})
    let scroll = screen.getByLabelText(i18n.t('auth.password')).parent
    while (scroll && scroll.type !== 'RCTScrollView') scroll = scroll.parent
    expect(scroll).not.toBeNull()
    expect(scroll!.props.keyboardShouldPersistTaps).toBe('handled')
    // No capture of child taps: the password toggle responds on the first tap.
    const event = { target: {}, nativeEvent: { touches: [] } }
    expect(scroll!.props.onStartShouldSetResponderCapture(event)).toBe(false)
    await fireEvent.press(screen.getByTestId('password-visibility'))
    expect(screen.getByLabelText(i18n.t('auth.password')).props.secureTextEntry).toBe(false)
    expect(blur).not.toHaveBeenCalled()
    // An unhandled tap on blank content becomes the scroll responder and blurs.
    expect(scroll!.props.onStartShouldSetResponder(event)).toBe(true)
    await act(async () => { scroll!.props.onResponderRelease(event) })
    expect(blur).toHaveBeenCalledWith(focused)
    expect(TextInput.State.currentlyFocusedInput()).toBeNull()
  } finally {
    state.blurInput(focused)
    state.unregisterInput(focused)
    jest.restoreAllMocks()
  }
})
