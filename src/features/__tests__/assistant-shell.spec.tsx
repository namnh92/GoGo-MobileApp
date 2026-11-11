import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import '@/shared/i18n'

/**
 * GoGo-MobileApp#379 (AI-APP-002) — the `/assistant` route opened by every
 * entry point: header with Back, the avatar, the greeting and the
 * removable place chip. Since #378 it is the real assistant (Welcome, then the
 * conversation), so these specs run it against the scripted backend, and the
 * "Chat saved" toast fires on the first close once a chat exists.
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
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => true }))

import AssistantRoute from '@/app/assistant'
import { useAssistantIntroStore, takeChatSavedToast } from '@/shared/store/assistantIntroStore'

import { installBackend, renderAssistant, resetAssistantSpecState, settle, syncTanstackNotifications, settleIdle } from './assistant-harness'

syncTanstackNotifications()

async function open() {
  const view = await renderAssistant(<AssistantRoute />)
  // The availability check answers right away; let it land inside act.
  await settleIdle()
  return view
}

beforeEach(() => {
  resetAssistantSpecState()
  installBackend({ seed: false })
  mockRouter.back.mockReset()
  mockParams.value = {}
  mockGate.on = true
})

it('greets, with the composer ready — no more "coming soon"', async () => {
  const view = await open()
  expect(view.getByText('GoGo AI')).toBeTruthy()
  expect(view.queryByTestId('app-header-bell')).toBeNull()
  expect(view.getByText('Làm quen với GoGo AI')).toBeTruthy()
  expect(view.queryByText(/sắp ra mắt/)).toBeNull()
  // Decorative: hidden from screen readers, "GoGo AI" is written beside it.
  expect(view.getByTestId('assistant-avatar-lg', { includeHiddenElements: true })).toBeTruthy()
  expect(view.getByPlaceholderText('Hỏi GoGo bất cứ điều gì…')).toBeTruthy()
})

it('goes back with the arrow in its header', async () => {
  const view = await open()
  await fireEvent.press(view.getByRole('button', { name: 'Quay lại' }))
  expect(mockRouter.back).toHaveBeenCalledTimes(1)
})

it('opening clears the "New" badge for the account', async () => {
  await open()
  expect(useAssistantIntroStore.getState().accounts.u1?.opened).toBe(true)
})

it('opened from a place, carries it as a removable chip, and sends the question', async () => {
  mockParams.value = { placeId: 'place-1', placeName: 'Nhà Lá Café', question: 'Có hợp ngân sách của mình không?' }
  const view = await open()
  expect(view.getByTestId('assistant-context-chip')).toBeTruthy()
  await waitFor(() => expect(view.getByLabelText('Bạn: Có hợp ngân sách của mình không?')).toBeTruthy())
  await waitFor(() => expect(view.getByTestId('assistant-sources')).toBeTruthy(), { timeout: 3000 })
  await settle()
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Bỏ Nhà Lá Café khỏi cuộc trò chuyện' }))
  })
  expect(view.queryByTestId('assistant-context-chip')).toBeNull()
})

it('closing before any chat says nothing about a saved chat', async () => {
  const view = await open()
  await act(async () => {
    await view.unmount()
  })
  // The flag is not spent: the first real chat still gets the toast.
  expect(useAssistantIntroStore.getState().accounts.u1?.chatSavedToastShown).toBe(false)
})

it('closing after a chat says "Chat saved in GoGo AI history", once per account (#378)', async () => {
  mockParams.value = { question: 'Kế hoạch nhóm hoạt động thế nào?' }
  const { ToastProvider } = jest.requireActual<typeof import('@/shared/ui/toast.view')>('@/shared/ui/toast.view')
  const { QueryClient, QueryClientProvider } = jest.requireActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
  const client = new QueryClient()
  // The toast lives above the screen, as in the app: closing unmounts only the screen.
  const Host = ({ show }: { show: boolean }) => (
    <QueryClientProvider client={client}>
      <ToastProvider>{show ? <AssistantRoute /> : null}</ToastProvider>
    </QueryClientProvider>
  )
  await render(<Host show />)
  await waitFor(() => expect(screen.getByTestId('assistant-sources')).toBeTruthy(), { timeout: 3000 })
  await settle()
  await act(async () => {
    await screen.rerender(<Host show={false} />)
  })
  expect(screen.getByText('Cuộc trò chuyện đã được lưu trong lịch sử GoGo AI')).toBeTruthy()
  expect(useAssistantIntroStore.getState().accounts.u1?.chatSavedToastShown).toBe(true)
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

it('is a normal full-screen stack card on both platforms', () => {
  const layout = readFileSync(path.resolve(__dirname, '../../app/_layout.tsx'), 'utf8')
  expect(layout).toMatch(/<Stack\.Screen\s+name="assistant"/)
  expect(layout).toMatch(/presentation: 'card'/)
  expect(layout).not.toMatch(/pageSheet|formSheet|transparentModal|fullScreenModal/)
  expect(layout).toMatch(/gestureEnabled: true/)
})
