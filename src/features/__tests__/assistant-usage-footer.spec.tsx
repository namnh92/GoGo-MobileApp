import { act, fireEvent, waitFor, within } from '@testing-library/react-native'
import i18n from '@/shared/i18n'
import type { AssistantStatus } from '@/shared/api'
import { ApiError } from '@/shared/api/errors'
import { setAssistantBackend } from '@/shared/api/assistant-backend'
import { createMockAssistantBackend } from '@/data/assistant/mock-backend'
import { formatClock, formatShortDate } from '@/features/assistant/format'
import { touchTarget } from '@/shared/ui/tokens'

const mockFocus = jest.fn()
const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => true }),
  useFocusEffect: (callback: () => void) => mockFocus(callback),
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'u1' } }),
}))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => true }))
let mockCreditsEnabled = true
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => ({ data: { actorType: 'user', capabilities: { assistantCredits: mockCreditsEnabled } } }),
  useMyCredits: () => ({ data: { availableBalance: 75 }, refetch: jest.fn() }),
}))

import AssistantRoute from '@/app/assistant'
import { callsTo, renderAssistant, resetAssistantSpecState, settle, spyOn, syncTanstackNotifications } from './assistant-harness'

syncTanstackNotifications()

let status: AssistantStatus
beforeEach(async () => {
  resetAssistantSpecState()
  jest.clearAllMocks()
  mockCreditsEnabled = true
  await i18n.changeLanguage('vi')
  jest.setSystemTime(new Date(2026, 10, 11, 9, 0))
  status = { state: 'enabled', creditBalance: 75, remainingToday: 7, dailyMessageLimit: 19, resetsAt: new Date(2026, 10, 11, 23, 45).toISOString() }
})
afterEach(async () => { await i18n.changeLanguage('vi') })

function install(getStatus = async () => status) {
  const backend = spyOn({
    ...createMockAssistantBackend({ speed: 0, actor: () => 'user', seed: false }),
    getStatus,
    // Keep the stream open: acceptance must refresh status before a terminal event.
    openStream: () => ({ close: jest.fn() }),
  })
  setAssistantBackend(backend)
  return backend
}

it.each(['vi', 'en'])('shows the API allowance beside existing credit with a full accessible label (%s)', async locale => {
  await i18n.changeLanguage(locale)
  install()
  const view = await renderAssistant(<AssistantRoute />)
  const footer = within(view.getByTestId('assistant-usage-footer'))
  const label = locale === 'vi' ? 'Miễn phí hôm nay: 7/19' : 'Free sends today: 7/19'
  await waitFor(() => expect(footer.getByLabelText(label)).toBeTruthy())
  expect(footer.getByText('75')).toBeTruthy()
  expect(footer.getByText(i18n.t('credits.title'))).toBeTruthy()
  expect(footer.getByLabelText(label).props.numberOfLines).toBe(1)
})

it.each(['vi', 'en'])('zero remaining names the reset in local HH:mm without blocking a credit-funded send (%s)', async locale => {
  await i18n.changeLanguage(locale)
  status = { ...status, remainingToday: 0 }
  install()
  const view = await renderAssistant(<AssistantRoute />)
  const expected = locale === 'vi' ? 'Hết miễn phí hôm nay · Đặt lại 23:45' : "Today's free sends used up · Resets 23:45"
  await waitFor(() => expect(view.getByLabelText(expected)).toBeTruthy())
  await act(async () => { fireEvent.changeText(view.getByLabelText(i18n.t('assistant.composer.label')), 'A question') })
  expect(view.getByRole('button', { name: i18n.t('assistant.composer.send') })).toBeEnabled()
})

it('includes the local date when the allowance resets on another day', async () => {
  status = { ...status, remainingToday: 0, resetsAt: new Date(2026, 10, 12, 0, 15).toISOString() }
  install()
  const view = await renderAssistant(<AssistantRoute />)
  const time = `${formatShortDate(status.resetsAt, 'vi')} · ${formatClock(status.resetsAt)}`
  await waitFor(() => expect(view.getByLabelText(`Hết miễn phí hôm nay · Đặt lại ${time}`)).toBeTruthy())
})

it('refetches and updates after each accepted send while the reply stream is open', async () => {
  const backend = install()
  const original = backend.sendMessage
  backend.sendMessage = async (...args) => {
    const turn = await original(...args)
    status = { ...status, remainingToday: status.remainingToday - 1 }
    return turn
  }
  const view = await renderAssistant(<AssistantRoute />)
  await waitFor(() => expect(view.getByText('Miễn phí hôm nay: 7/19')).toBeTruthy())
  for (const remaining of [6, 5]) {
    const reads = callsTo(backend, 'getStatus').length
    await act(async () => { fireEvent.changeText(view.getByLabelText('Tin nhắn cho GoGo AI'), 'Một câu hỏi') })
    await act(async () => { fireEvent.press(view.getByRole('button', { name: 'Gửi' })) })
    await waitFor(() => expect(view.getByText(`Miễn phí hôm nay: ${remaining}/19`)).toBeTruthy())
    expect(callsTo(backend, 'getStatus').length).toBeGreaterThan(reads)
    expect(view.getByRole('button', { name: 'Dừng' })).toBeTruthy()
    // A new chat allows another accepted send without completing the old reply.
    await act(async () => { fireEvent.press(view.getByRole('button', { name: 'Lịch sử trò chuyện' })) })
    await waitFor(() => expect(view.getByTestId('assistant-history-list')).toBeTruthy())
    await act(async () => { fireEvent.press(view.getByTestId('assistant-history-new-chat')) })
    await settle()
  }
})

it('refetches fresh status when the mounted screen gains focus', async () => {
  const backend = install()
  const view = await renderAssistant(<AssistantRoute />)
  await waitFor(() => expect(view.getByText('Miễn phí hôm nay: 7/19')).toBeTruthy())
  const reads = callsTo(backend, 'getStatus').length
  status = { ...status, remainingToday: 3 }
  // The screen registers its status callback before the credit child registers its own.
  await act(async () => { mockFocus.mock.calls[0][0]() })
  await waitFor(() => expect(view.getByText('Miễn phí hôm nay: 3/19')).toBeTruthy())
  expect(callsTo(backend, 'getStatus').length).toBeGreaterThan(reads)
})

it('keeps the row height during loading and shows no invented allowance', async () => {
  install(() => new Promise(() => {}))
  const view = await renderAssistant(<AssistantRoute />)
  expect(view.getByTestId('assistant-usage-loading')).toBeTruthy()
  expect(view.getByTestId('assistant-usage-footer')).toHaveStyle({ minHeight: touchTarget.min })
  expect(view.queryByText(/Miễn phí hôm nay:/)).toBeNull()
  expect(view.getByText('75')).toBeTruthy()
})

it('omits allowance on an initial error and keeps existing credits', async () => {
  install(async () => { throw new ApiError(503, { code: 'UNAVAILABLE', message: 'unavailable' }) })
  const view = await renderAssistant(<AssistantRoute />)
  await waitFor(() => expect(view.queryByTestId('assistant-usage-loading')).toBeNull())
  expect(view.queryByText(/Miễn phí hôm nay:|Hết miễn phí hôm nay/)).toBeNull()
  expect(view.getByText('75')).toBeTruthy()
})

it('omits cached allowance too when a focus refresh fails', async () => {
  let fail = false
  install(async () => {
    if (fail) throw new ApiError(503, { code: 'UNAVAILABLE', message: 'unavailable' })
    return status
  })
  const view = await renderAssistant(<AssistantRoute />)
  await waitFor(() => expect(view.getByText('Miễn phí hôm nay: 7/19')).toBeTruthy())
  fail = true
  await act(async () => { mockFocus.mock.calls[0][0]() })
  await waitFor(() => expect(view.queryByText(/Miễn phí hôm nay:/)).toBeNull())
  expect(view.getByText('75')).toBeTruthy()
})

it('preserves the disabled notice and omits free sends', async () => {
  status = { ...status, state: 'disabled' }
  install()
  const view = await renderAssistant(<AssistantRoute />)
  await waitFor(() => expect(view.queryByTestId('assistant-usage-loading')).toBeNull())
  expect(view.getByText(i18n.t('assistant.notice.disabled.title'))).toBeTruthy()
  expect(view.queryByText(/Miễn phí hôm nay:/)).toBeNull()
})

it('still shows allowance when the account has no credit capability', async () => {
  mockCreditsEnabled = false
  install()
  const view = await renderAssistant(<AssistantRoute />)
  await waitFor(() => expect(view.getByText('Miễn phí hôm nay: 7/19')).toBeTruthy())
  expect(view.queryByTestId('credit-balance-row')).toBeNull()
})
