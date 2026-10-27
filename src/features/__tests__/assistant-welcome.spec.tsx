import { act, fireEvent, waitFor } from '@testing-library/react-native'

/**
 * GoGo-MobileApp#378 (AI-APP-001) — Welcome (design `ScreenWelcome`,
 * `ScreenEntryOpen`): greeting, four starting points, the composer with
 * attach / microphone / send and the disclaimer; opened about a place, the
 * place rides as a removable chip and its id goes with the message.
 */

const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true }
const mockParams: { value: Record<string, string> } = { value: {} }
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams.value,
  Redirect: () => null,
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'u1' } }),
}))
const mockUuid = { next: 0 }
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuid.next).padStart(12, '0')}` }))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => true }))

import AssistantRoute from '@/app/assistant'

import { callsTo, installBackend, renderAssistant, resetAssistantSpecState, settle, settleIdle, syncTanstackNotifications } from './assistant-harness'

syncTanstackNotifications()

beforeEach(() => {
  resetAssistantSpecState()
  mockParams.value = {}
  mockRouter.push.mockReset()
})

it('greets with the fixed copy and four starting points', async () => {
  installBackend()
  const view = await renderAssistant(<AssistantRoute />)
  expect(view.getByText('Chào bạn! GoGo có thể giúp gì cho bạn hôm nay?')).toBeTruthy()
  expect(view.getByText('Hỏi về địa điểm, kế hoạch và phòng, hoặc cách mọi thứ trong GoGo hoạt động.')).toBeTruthy()
  for (const title of ['Khám phá GoGo', 'Cách dùng GoGo', 'Tìm thông tin', 'Nhận hỗ trợ']) {
    expect(view.getByRole('button', { name: new RegExp(`^${title}\\.`) })).toBeTruthy()
  }
  expect(view.getByTestId('assistant-avatar-lg', { includeHiddenElements: true })).toBeTruthy()
  await settle()
})

it('the composer: placeholder, disclaimer, send off until there is text, microphone says it is coming', async () => {
  installBackend()
  const view = await renderAssistant(<AssistantRoute />)
  expect(view.getByPlaceholderText('Hỏi GoGo bất cứ điều gì…')).toBeTruthy()
  expect(view.getByText('GoGo AI có thể nhầm. Hãy kiểm tra thông tin quan trọng.')).toBeTruthy()
  expect(view.getByRole('button', { name: 'Gửi' })).toBeDisabled()
  expect(view.getByRole('button', { name: 'Nhập bằng giọng nói sắp có' })).toBeDisabled()
  expect(view.getByRole('button', { name: 'Đính kèm ảnh' })).toBeEnabled()
  await act(async () => {
    await fireEvent.changeText(view.getByLabelText('Tin nhắn cho GoGo AI'), 'Kế hoạch nhóm hoạt động thế nào?')
  })
  await waitFor(() => expect(view.getByRole('button', { name: 'Gửi' })).toBeEnabled())
  await settle()
})

it('a starting point sends its title as the first message and the conversation opens', async () => {
  const backend = installBackend({ seed: false })
  const view = await renderAssistant(<AssistantRoute />)
  await waitFor(() => expect(view.getByRole('button', { name: /^Cách dùng GoGo\./ })).toBeEnabled())
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: /^Cách dùng GoGo\./ }))
  })
  await waitFor(() => expect(view.getByTestId('assistant-sources')).toBeTruthy())
  expect(callsTo(backend, 'sendMessage')[0]![1]).toMatchObject({ text: 'Cách dùng GoGo', locale: 'vi' })
  expect(view.queryByTestId('assistant-welcome')).toBeNull()
  // A conversation exists now: New chat appears in the header.
  expect(view.getByRole('button', { name: 'Cuộc trò chuyện mới' })).toBeTruthy()
  await settle()
})

it('opened about a place: the chip, starter questions, and the place id travels with the message', async () => {
  const backend = installBackend({ seed: false })
  mockParams.value = { placeId: '1b2c3d4e-0000-4000-8000-000000000001', placeName: 'Nhà Lá Café' }
  const view = await renderAssistant(<AssistantRoute />)
  expect(view.getByText('Bạn muốn biết gì về Nhà Lá Café?')).toBeTruthy()
  expect(view.getByTestId('assistant-context-chip')).toBeTruthy()
  await waitFor(() => expect(view.getByRole('button', { name: 'Thử hỏi Có hợp ngân sách của mình không?' })).toBeEnabled())
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Thử hỏi Có hợp ngân sách của mình không?' }))
  })
  await waitFor(() => expect(callsTo(backend, 'sendMessage')).toHaveLength(1))
  const [, body] = callsTo(backend, 'sendMessage')[0]!
  expect(body).toMatchObject({ text: 'Có hợp ngân sách của mình không?', context: { placeId: '1b2c3d4e-0000-4000-8000-000000000001' } })
  expect(callsTo(backend, 'createConversation')[0]![0]).toEqual({ context: { placeId: '1b2c3d4e-0000-4000-8000-000000000001' } })
  await waitFor(() => expect(view.getByTestId('assistant-sources')).toBeTruthy())
  await settleIdle()
})

it('a question tapped on the place card is sent once, with the place attached', async () => {
  const backend = installBackend({ seed: false })
  mockParams.value = { placeId: '1b2c3d4e-0000-4000-8000-000000000001', placeName: 'Nhà Lá Café', question: 'Cuối tuần có mở khuya không?' }
  const view = await renderAssistant(<AssistantRoute />)
  await waitFor(() => expect(view.getByTestId('assistant-sources')).toBeTruthy(), { timeout: 4000 })
  expect(callsTo(backend, 'sendMessage')).toHaveLength(1)
  expect(callsTo(backend, 'sendMessage')[0]![1]).toMatchObject({ text: 'Cuối tuần có mở khuya không?', context: { placeId: '1b2c3d4e-0000-4000-8000-000000000001' } })
  await settle()
})

it('removing the chip sends without the place', async () => {
  const backend = installBackend({ seed: false })
  mockParams.value = { placeId: '1b2c3d4e-0000-4000-8000-000000000001', placeName: 'Nhà Lá Café' }
  const view = await renderAssistant(<AssistantRoute />)
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Bỏ Nhà Lá Café khỏi cuộc trò chuyện' }))
  })
  expect(view.queryByTestId('assistant-context-chip')).toBeNull()
  await waitFor(() => expect(view.getByRole('button', { name: /^Khám phá GoGo\./ })).toBeEnabled())
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: /^Khám phá GoGo\./ }))
  })
  await waitFor(() => expect(callsTo(backend, 'sendMessage')).toHaveLength(1))
  expect(callsTo(backend, 'sendMessage')[0]![1]).not.toHaveProperty('context')
  await settle()
})
