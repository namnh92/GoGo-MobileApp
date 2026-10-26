import { act, fireEvent, waitFor } from '@testing-library/react-native'

/**
 * GoGo-MobileApp#378 (AI-APP-001) — the states around sending (design
 * `ScreenStatesOutcome`, `StateNotice`, `OfflineBanner`): a failed send keeps
 * the message "Not sent" and Retry re-sends it under the same
 * Idempotency-Key; offline shows the banner and turns Send off; the daily
 * limit, a burst limit and the kill switch say so; a guest is asked to sign
 * in (owner decision on #377) and never reaches the API.
 */

const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true }
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}))
const mockSession: { value: { status: string; session: unknown } } = {
  value: { status: 'user', session: { kind: 'user', userId: 'u1' } },
}
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => mockSession.value }))
const mockOnline = { value: true }
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => mockOnline.value }))
const mockUuid = { next: 0 }
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuid.next).padStart(12, '0')}` }))

import AssistantRoute from '@/app/assistant'
import { setAssistantBackend } from '@/shared/api/assistant-backend'
import { ApiError } from '@/shared/api/errors'

import { callsTo, installBackend, renderAssistant, resetAssistantSpecState, settle, spyOn, syncTanstackNotifications } from './assistant-harness'
import { createMockAssistantBackend } from '@/data/assistant/mock-backend'

syncTanstackNotifications()

beforeEach(() => {
  resetAssistantSpecState()
  mockOnline.value = true
  mockSession.value = { status: 'user', session: { kind: 'user', userId: 'u1' } }
  mockRouter.push.mockReset()
})

type View = Awaited<ReturnType<typeof renderAssistant>>

async function ask(view: View, text: string) {
  await act(async () => {
    await fireEvent.changeText(view.getByLabelText('Tin nhắn cho GoGo AI'), text)
  })
  await waitFor(() => expect(view.getByRole('button', { name: 'Gửi' })).toBeEnabled())
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Gửi' }))
  })
}

it('a network failure keeps the message "Not sent"; Retry sends it again under the same key', async () => {
  const backend = installBackend({ seed: false })
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'Thử mất mạng')
  await waitFor(() => expect(view.getByText('Chưa gửi. Chạm để thử lại')).toBeTruthy())
  expect(view.getByText('Không kết nối được GoGo')).toBeTruthy()
  expect(view.getByText('Kiểm tra kết nối rồi thử lại. Tin nhắn của bạn vẫn được giữ.')).toBeTruthy()
  expect(view.getByText('Thử mất mạng')).toBeTruthy()
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Thử lại' }))
  })
  await waitFor(() => expect(view.getByTestId('assistant-sources')).toBeTruthy())
  const sends = callsTo(backend, 'sendMessage')
  expect(sends).toHaveLength(2)
  expect(sends[1]![2]).toBe(sends[0]![2])
  // One conversation, not two.
  expect(callsTo(backend, 'createConversation')).toHaveLength(1)
  expect(view.queryByText('Chưa gửi. Chạm để thử lại')).toBeNull()
  await settle()
})

it('offline: the banner under the header, the status says offline, and Send is off', async () => {
  mockOnline.value = false
  installBackend()
  const view = await renderAssistant(<AssistantRoute />)
  expect(view.getByTestId('assistant-offline-banner')).toBeTruthy()
  expect(view.getByText('Không có kết nối. Kiểm tra mạng của bạn.')).toBeTruthy()
  expect(view.getByText('Ngoại tuyến')).toBeTruthy()
  await act(async () => {
    await fireEvent.changeText(view.getByLabelText('Tin nhắn cho GoGo AI'), 'Xin chào')
  })
  expect(view.getByRole('button', { name: 'Gửi' })).toBeDisabled()
  expect(view.getByText('Bạn đang ngoại tuyến. Chưa gửi được cho đến khi có mạng.')).toBeTruthy()
  await settle()
})

it('the daily limit: the message stays "Not sent" with when it resets, and the composer turns off', async () => {
  installBackend({ seed: false })
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'Chạm giới hạn')
  await waitFor(() => expect(view.getAllByText('Bạn đã dùng hết tin nhắn hôm nay').length).toBeGreaterThan(0))
  expect(view.getByText('Chưa gửi')).toBeTruthy()
  // No Retry: it cannot help until the reset.
  expect(view.queryByRole('button', { name: 'Thử lại' })).toBeNull()
  await waitFor(() => expect(view.getByText('Tạm thời chưa gửi được.')).toBeTruthy())
  expect(view.getAllByText(/Bạn có thể gửi tiếp từ \d\d:\d\d\./).length).toBeGreaterThan(0)
  await settle()
})

it('a burst limit asks to wait, and Retry stays', async () => {
  installBackend({ seed: false })
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'gửi nhiều quá')
  await waitFor(() => expect(view.getByText('Gửi quá nhanh')).toBeTruthy())
  // The per-minute limit is the status's `messagesPerMinuteLimit`, never a number in the app.
  expect(view.getByText('Mỗi phút gửi được tối đa 5 tin nhắn. Đợi một chút rồi thử lại.')).toBeTruthy()
  expect(view.getByRole('button', { name: 'Thử lại' })).toBeTruthy()
  await settle()
})

it('a burst limit reads its number from the status: another configured limit shows that one', async () => {
  const backend = spyOn({
    ...createMockAssistantBackend({ speed: 0, actor: () => 'user' }),
    getStatus: async () => ({ state: 'enabled', dailyMessageLimit: 12, remainingToday: 9, resetsAt: '2026-10-27T17:00:00Z', messagesPerMinuteLimit: 2 }),
  })
  setAssistantBackend(backend)
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'gửi nhiều quá')
  await waitFor(() => expect(view.getByText('Mỗi phút gửi được tối đa 2 tin nhắn. Đợi một chút rồi thử lại.')).toBeTruthy())
  await settle()
})

it('the kill switch: "isn’t available right now", from a send or from the status', async () => {
  installBackend({ seed: false })
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'tắt trợ lý đi')
  await waitFor(() => expect(view.getAllByText('GoGo AI tạm thời không khả dụng').length).toBeGreaterThan(0))
  await settle()
})

it('a disabled status turns sending off before anything is typed', async () => {
  const backend = spyOn({
    ...createMockAssistantBackend({ speed: 0, actor: () => 'user' }),
    getStatus: async () => ({ state: 'disabled', dailyMessageLimit: 50, remainingToday: 50, resetsAt: '2026-10-27T17:00:00Z' }),
  })
  setAssistantBackend(backend)
  const view = await renderAssistant(<AssistantRoute />)
  await waitFor(() => expect(view.getByText('GoGo AI tạm thời không khả dụng')).toBeTruthy())
  expect(view.getByRole('button', { name: /^Khám phá GoGo\./ })).toBeDisabled()
  await settle()
})

it('a guest is asked to sign in and no assistant call is made', async () => {
  mockSession.value = { status: 'guest', session: { kind: 'guest', roomId: 'r1' } }
  const backend = installBackend({ actor: () => 'guest' })
  const view = await renderAssistant(<AssistantRoute />)
  expect(view.getByText('Đăng nhập để dùng GoGo AI')).toBeTruthy()
  expect(view.queryByLabelText('Tin nhắn cho GoGo AI')).toBeNull()
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Đăng nhập' }))
  })
  expect(mockRouter.push).toHaveBeenCalledWith('/auth/sign-in')
  expect(backend.calls).toEqual([])
})

it('403 USER_ONLY from the API also leads to the sign-in prompt', async () => {
  const backend = spyOn({
    ...createMockAssistantBackend({ speed: 0, actor: () => 'user' }),
    getStatus: async () => {
      throw new ApiError(403, { code: 'USER_ONLY', message: 'Registered users only' })
    },
  })
  setAssistantBackend(backend)
  const view = await renderAssistant(<AssistantRoute />)
  await waitFor(() => expect(view.getByText('Đăng nhập để dùng GoGo AI')).toBeTruthy())
  await settle()
})
