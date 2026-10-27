import { act, fireEvent } from '@testing-library/react-native'
import { Dimensions } from 'react-native'

/**
 * iOS acceptance BUG2 (GoGo-MobileApp#378): in the page sheet the keyboard
 * covered the composer, the disclaimer and the "Dừng sẽ giữ phần đã viết."
 * hint. `KeyboardAvoidingView` measures itself relative to the sheet but the
 * keyboard in window coordinates, and was never told the sheet starts lower
 * than the window. The sheet's gap — window height minus sheet height — is
 * now its `keyboardVerticalOffset`.
 *
 * jest has no keyboard or page sheet: this checks the wiring (the measured
 * gap reaches the avoiding view); the resulting position was checked on the
 * iPhone SE simulator.
 */

// The real one renders a plain View and drops its own props; this keeps the
// offset readable on the host view, so the spec sees what the screen passed.
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const View = jest.requireActual('react-native/Libraries/Components/View/View').default
  return {
    __esModule: true,
    default: ({ keyboardVerticalOffset, ...props }: { keyboardVerticalOffset?: number }) =>
      React.createElement(View, { ...props, testID: 'keyboard-avoiding', keyboardVerticalOffset }),
  }
})

const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true }
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'u1' } }),
}))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => true }))

import AssistantRoute from '@/app/assistant'

import { installBackend, renderAssistant, resetAssistantSpecState, settle, syncTanstackNotifications } from './assistant-harness'

syncTanstackNotifications()

beforeEach(() => resetAssistantSpecState())

it('before the sheet is measured there is no offset', async () => {
  installBackend()
  const view = await renderAssistant(<AssistantRoute />)
  expect(view.getByTestId('keyboard-avoiding').props.keyboardVerticalOffset).toBe(0)
  await settle()
})

it('the avoiding view is offset by the gap between the window top and the sheet', async () => {
  installBackend()
  const view = await renderAssistant(<AssistantRoute />)
  const windowHeight = Dimensions.get('window').height
  await act(async () => {
    await fireEvent(view.getByTestId('assistant-screen'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 375, height: windowHeight - 40 } },
    })
  })
  expect(view.getByTestId('keyboard-avoiding').props.keyboardVerticalOffset).toBe(40)
  await settle()
})
