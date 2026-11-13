import { act, fireEvent, waitFor, within } from '@testing-library/react-native'
import { DeviceEventEmitter } from 'react-native'

// Exercise RN's real IME height calculation, rather than its default Jest stub.
jest.unmock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView')
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: {
    OS: 'android',
    select: (values: Record<string, unknown>) => values.android ?? values.native ?? values.default,
  },
}))
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'u1' } }),
}))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => true }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => ({ data: { actorType: 'user', capabilities: { assistantCredits: true } } }),
  useMyCredits: () => ({ data: { balance: 100, availableBalance: 75, reserved: 25 }, refetch: jest.fn() }),
}))

import AssistantRoute from '@/app/assistant'

import { callsTo, installBackend, renderAssistant, resetAssistantSpecState, settle, syncTanstackNotifications } from './assistant-harness'

syncTanstackNotifications()
beforeEach(resetAssistantSpecState)

it('shrinks the full-screen chat above the Android IME, keeps both footer controls inside, and sends without manually hiding it', async () => {
  const backend = installBackend({ seed: false })
  const screen = await renderAssistant(<AssistantRoute />)
  const host = () => screen.getByTestId('assistant-footer').parent!
  // Logical layout coordinates, not a claim of SM-A226B device measurements.
  // Edge-to-edge: opening the IME does not change the window's 844pt height.
  await act(async () => {
    await fireEvent(host(), 'layout', {
      persist: () => {},
      nativeEvent: { layout: { x: 0, y: 100, width: 390, height: 744 } },
    })
    DeviceEventEmitter.emit('keyboardDidShow', {
      duration: 0,
      easing: 'keyboard',
      endCoordinates: { screenX: 0, screenY: 500, width: 390, height: 344 },
    })
  })
  // The real RN component must reduce 744 by the 344pt IME overlap.
  expect(host()).toHaveStyle({ height: 400, flex: 0 })
  const footer = within(host()).getByTestId('assistant-footer')
  expect(footer).toHaveStyle({ paddingBottom: 0 })
  expect(within(footer).getByTestId('credit-balance-row')).toBeTruthy()
  const input = within(footer).getByLabelText('Tin nhắn cho GoGo AI')
  await act(async () => { await fireEvent.changeText(input, 'Kế hoạch nhóm hoạt động thế nào?') })
  expect(input.props.value).toBe('Kế hoạch nhóm hoạt động thế nào?')
  const send = within(footer).getByRole('button', { name: 'Gửi' })
  await waitFor(() => expect(send).toBeEnabled())
  await act(async () => { await fireEvent.press(send) })
  await waitFor(() => expect(callsTo(backend, 'sendMessage')).toHaveLength(1))
  // No keyboardDidHide was needed before pressing Send. Existing submit may
  // dismiss it afterwards; keep that interaction unchanged.
  await act(async () => { DeviceEventEmitter.emit('keyboardDidHide', {}) })
  expect(host()).not.toHaveStyle({ height: 400 })
  expect(screen.getByTestId('assistant-footer')).toHaveStyle({ paddingBottom: 34 })
  await settle()
})
