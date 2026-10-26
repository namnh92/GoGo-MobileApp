import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, screen } from '@testing-library/react-native'

import '@/shared/i18n'

/**
 * GoGo-MobileApp#379 (AI-APP-002) — the `/assistant` route opened by every
 * entry point. A shell until #378: header with Close (×), the avatar, the
 * greeting, one line saying the assistant is on its way, and the removable
 * place chip. No chat, no network.
 */

const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: () => true }
const mockParams: { value: Record<string, string> } = { value: {} }
const mockGate = { on: true }

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams.value,
  Redirect: function Redirect({ href }: { href: string }) {
    const { Text } = jest.requireActual<typeof import('react-native')>('react-native')
    return <Text>{`redirect:${href}`}</Text>
  },
}))
// The gate reads `env.assistantEntry` (#379); `undefined` follows the dev flavour (on).
jest.mock('@/shared/config/env', () => {
  const actual = jest.requireActual('@/shared/config/env')
  // A getter, read when the gate is asked — not copied once when the mock is built.
  const env = { ...actual.env }
  Object.defineProperty(env, 'assistantEntry', { get: () => (mockGate?.on === false ? 'off' : undefined) })
  return { env }
})
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'u1' } }),
}))

import AssistantRoute from '@/app/assistant'
import { useAssistantIntroStore, takeChatSavedToast } from '@/shared/store/assistantIntroStore'
import { ToastProvider } from '@/shared/ui/toast.view'

async function open() {
  await render(
    <ToastProvider>
      <AssistantRoute />
    </ToastProvider>,
  )
  return screen
}

beforeEach(() => {
  mockRouter.back.mockReset()
  mockParams.value = {}
  mockGate.on = true
  useAssistantIntroStore.setState({ accounts: {} })
})

it('greets, says the assistant is on its way, and shows no chat', async () => {
  const view = await open()
  expect(view.getByText('GoGo AI')).toBeTruthy()
  expect(view.getByText('Chào bạn! GoGo có thể giúp gì cho bạn hôm nay?')).toBeTruthy()
  expect(view.getByText(/GoGo AI sắp ra mắt/)).toBeTruthy()
  // Decorative: hidden from screen readers, "GoGo AI" is written beside it.
  expect(view.getByTestId('assistant-avatar-lg', { includeHiddenElements: true })).toBeTruthy()
  expect(view.queryByPlaceholderText(/./)).toBeNull()
})

it('closes with the × in its header', async () => {
  const view = await open()
  await fireEvent.press(view.getByRole('button', { name: 'Đóng GoGo AI' }))
  expect(mockRouter.back).toHaveBeenCalledTimes(1)
})

it('opening clears the "New" badge for the account', async () => {
  await open()
  expect(useAssistantIntroStore.getState().accounts.u1?.opened).toBe(true)
})

it('opened from a place, carries it as a removable chip, with the question', async () => {
  mockParams.value = { placeId: 'place-1', placeName: 'Nhà Lá Café', question: 'Có hợp ngân sách của mình không?' }
  const view = await open()
  expect(view.getByTestId('assistant-context-chip')).toBeTruthy()
  expect(view.getByText('Có hợp ngân sách của mình không?')).toBeTruthy()
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Bỏ Nhà Lá Café khỏi cuộc trò chuyện' }))
  })
  expect(view.queryByTestId('assistant-context-chip')).toBeNull()
})

it('closing the shell says nothing about a saved chat — there is none yet', async () => {
  const view = await open()
  await act(async () => {
    await view.unmount()
  })
  // The flag is not spent: the first real chat still gets the toast.
  expect(useAssistantIntroStore.getState().accounts.u1?.chatSavedToastShown).toBe(false)
})

it('"Chat saved in GoGo AI history" is shown once per account, and only for a real chat', () => {
  expect(takeChatSavedToast('u1', false)).toBe(false)
  expect(takeChatSavedToast(null, true)).toBe(false)
  expect(takeChatSavedToast('u1', true)).toBe(true)
  expect(takeChatSavedToast('u1', true)).toBe(false)
  expect(takeChatSavedToast('u2', true)).toBe(true)
})

it('with the gate off the route leads home', async () => {
  mockGate.on = false
  const view = await open()
  expect(view.getByText('redirect:/')).toBeTruthy()
  expect(view.queryByText('GoGo AI')).toBeNull()
})

it('is presented as an iOS page sheet (swipe down closes) and full screen on Android', () => {
  const layout = readFileSync(path.resolve(__dirname, '../../app/_layout.tsx'), 'utf8')
  expect(layout).toMatch(/<Stack\.Screen\s+name="assistant"/)
  expect(layout).toMatch(/presentation: Platform\.OS === 'ios' \? 'pageSheet' : 'fullScreenModal'/)
  expect(layout).toMatch(/gestureEnabled: true/)
})
