import { act, fireEvent, within } from '@testing-library/react-native'
import { Dimensions } from 'react-native'

/** #627: full-screen keyboard avoidance must not infer a sheet gap from window height. */

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

let mockKeyboard = false
jest.mock('@/shared/ui/keyboard', () => ({ useKeyboardVisible: () => mockKeyboard }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => ({ data: { actorType: 'user', capabilities: { assistantCredits: true } } }),
  useMyCredits: () => ({ data: { balance: 100, availableBalance: 75, reserved: 25 }, refetch: jest.fn() }),
}))

const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true }
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: jest.fn(),
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

beforeEach(() => { mockKeyboard = false; resetAssistantSpecState() })

it('uses window coordinates with no modal offset', async () => {
  installBackend()
  const view = await renderAssistant(<AssistantRoute />)
  expect(view.getByTestId('keyboard-avoiding').props.keyboardVerticalOffset).toBe(0)
  expect(view.getByTestId('assistant-screen')).toHaveStyle({ paddingTop: 47 })
  await settle()
})

it('does not infer an offset from a smaller screen layout', async () => {
  installBackend()
  const view = await renderAssistant(<AssistantRoute />)
  const windowHeight = Dimensions.get('window').height
  await act(async () => {
    await fireEvent(view.getByTestId('assistant-screen'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 375, height: windowHeight - 40 } },
    })
  })
  expect(view.getByTestId('keyboard-avoiding').props.keyboardVerticalOffset).toBe(0)
  await settle()
})

// #633: both bottom controls share keyboard avoidance, with the inset after credit.
it.each([false, true])('keeps credit directly below the composer with keyboard visible=%s', async keyboard => {
  mockKeyboard = keyboard
  installBackend()
  const view = await renderAssistant(<AssistantRoute />)
  const avoiding = view.getByTestId('keyboard-avoiding')
  const footer = within(avoiding).getByTestId('assistant-footer')
  expect(footer).toHaveStyle({ paddingBottom: keyboard ? 0 : 34 })
  const children = footer.props.children
  expect(children).toHaveLength(2)
  expect(children[0].type).toBe(require('@/features/assistant/composer.view').Composer)
  expect(children[1].type).toBe(require('@/features/assistant/usage-footer.view').UsageFooter)
  expect(within(footer).getByTestId('assistant-composer')).toHaveStyle({ paddingBottom: 8 })
  expect(within(footer).getByTestId('credit-balance-row')).toBeTruthy()
  expect(within(footer).getByText('0/100')).toBeTruthy()
  expect(within(footer).getByText('Credit GoGo:')).toBeTruthy()
  await settle()
})
