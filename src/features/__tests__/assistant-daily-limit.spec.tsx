import { act, fireEvent, waitFor, within } from '@testing-library/react-native'

/**
 * iOS acceptance BUG4 (GoGo-MobileApp#378): the daily limit drew two stacked
 * "Bạn đã dùng hết tin nhắn hôm nay" notices with different reset times — one
 * under the refused message, from the 429's `Retry-After` and with the
 * wifi-off glyph, one from `status.resetsAt` — and on Welcome the notice sat
 * under the scroll view, squeezing the suggestion cards behind it.
 *
 * Contract 2.0.0-alpha.3 (GoGo-BE `openapi/gogo.v1.yaml`, `docs/assistant.md`):
 * the day resets at `resetsAt`, midnight Asia/Ho_Chi_Minh; the daily 429's
 * `Retry-After` points at that same reset. So: one notice, the clock glyph,
 * the time from `resetsAt`, and on Welcome the notice scrolls with the content.
 */

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
const mockUuid = { next: 0 }
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuid.next).padStart(12, '0')}` }))

import AssistantRoute from '@/app/assistant'
import { formatClock } from '@/features/assistant/format'
import { createMockAssistantBackend } from '@/data/assistant/mock-backend'
import { setAssistantBackend } from '@/shared/api/assistant-backend'
import { ApiError } from '@/shared/api/errors'

import { installBackend, renderAssistant, resetAssistantSpecState, settle, spyOn, syncTanstackNotifications } from './assistant-harness'

syncTanstackNotifications()

beforeEach(() => resetAssistantSpecState())

type View = Awaited<ReturnType<typeof renderAssistant>>

const LIMIT_TITLE = 'Bạn đã dùng hết tin nhắn hôm nay'

async function ask(view: View, text: string) {
  await act(async () => {
    await fireEvent.changeText(view.getByLabelText('Tin nhắn cho GoGo AI'), text)
  })
  await waitFor(() => expect(view.getByRole('button', { name: 'Gửi' })).toBeEnabled())
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Gửi' }))
  })
}

it('a send refused by the daily limit shows one notice, with the reset from status.resetsAt', async () => {
  const backend = installBackend({ seed: false })
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'Chạm giới hạn')
  await waitFor(() => expect(view.getByText('Tạm thời chưa gửi được.')).toBeTruthy())
  await settle()
  expect(view.getByText('Chưa gửi')).toBeTruthy()
  expect(view.getAllByText(LIMIT_TITLE)).toHaveLength(1)
  const status = await backend.getStatus()
  expect(view.getAllByText(/Bạn có thể gửi tiếp từ/)).toHaveLength(1)
  expect(view.getByText(`Bạn có thể gửi tiếp từ ${formatClock(status.resetsAt)}.`)).toBeTruthy()
  // The clock, never the wifi-off glyph of a network failure.
  expect(view.queryByTestId('icon-wifi-off', { includeHiddenElements: true })).toBeNull()
  expect(view.getAllByTestId('icon-clock', { includeHiddenElements: true })).toHaveLength(1)
  await settle()
})

it('before the status has caught up, the refused message names the reset from resetsAt, not Retry-After', async () => {
  const mock = createMockAssistantBackend({ speed: 0, actor: () => 'user', seed: false })
  const resetsAt = '2026-10-27T17:00:00Z'
  const backend = spyOn({
    ...mock,
    // The status still says `enabled` (it refetches after the send).
    getStatus: async () => ({ state: 'enabled', dailyMessageLimit: 30, remainingToday: 0, resetsAt, messagesPerMinuteLimit: 5 }),
    sendMessage: async () => {
      // A Retry-After one hour out — another time than the reset.
      throw new ApiError(429, { code: 'ASSISTANT_DAILY_LIMIT', message: 'Daily limit reached' }, '3600')
    },
  })
  setAssistantBackend(backend)
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'Một câu hỏi')
  await waitFor(() => expect(view.getByText(LIMIT_TITLE)).toBeTruthy())
  expect(view.getByText(`Bạn có thể gửi tiếp từ ${formatClock(resetsAt)}.`)).toBeTruthy()
  expect(view.getAllByText(LIMIT_TITLE)).toHaveLength(1)
  await settle()
})

it('the mock refuses with a Retry-After that points at resetsAt (midnight Asia/Ho_Chi_Minh)', async () => {
  const now = new Date('2026-10-27T08:05:00Z') // 15:05 in Hồ Chí Minh City
  const backend = createMockAssistantBackend({ speed: 0, actor: () => 'user', seed: false, now: () => now })
  const status = await backend.getStatus()
  expect(status.resetsAt).toBe('2026-10-27T17:00:00.000Z')
  const conversation = await backend.createConversation({}, 'conversation-key')
  const refused = await backend
    .sendMessage(conversation.id, { text: 'giới hạn', locale: 'vi' }, 'key-1')
    .then(() => null, (error: unknown) => error)
  expect(refused).toBeInstanceOf(ApiError)
  expect((refused as ApiError).code).toBe('ASSISTANT_DAILY_LIMIT')
  // Retry-After in seconds: 15:05 → 00:00 is 8 h 55 min.
  const seconds = ((refused as ApiError).retryAt - Date.now()) / 1000
  expect(Math.abs(seconds - (8 * 3600 + 55 * 60))).toBeLessThan(5)
})

it('on Welcome the limit notice scrolls with the content, above the starting points it explains', async () => {
  const backend = spyOn({
    ...createMockAssistantBackend({ speed: 0, actor: () => 'user' }),
    getStatus: async () => ({ state: 'limit_reached', dailyMessageLimit: 30, remainingToday: 0, resetsAt: '2026-10-27T17:00:00Z' }),
  })
  setAssistantBackend(backend)
  const view = await renderAssistant(<AssistantRoute />)
  await waitFor(() => expect(view.getByText(LIMIT_TITLE)).toBeTruthy())
  const welcome = view.getByTestId('assistant-welcome')
  expect(within(welcome).getByTestId('assistant-welcome-notice')).toBeTruthy()
  expect(within(welcome).getByText(LIMIT_TITLE)).toBeTruthy()
  expect(view.getAllByText(LIMIT_TITLE)).toHaveLength(1)
  await settle()
})
