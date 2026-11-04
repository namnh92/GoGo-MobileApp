import { act, fireEvent, waitFor, within } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'

/**
 * GoGo-MobileApp#378 (AI-APP-001) — the conversation and its reply states
 * (design `ScreenConversation`, `ScreenStatesInput`, `ScreenStatesOutcome`),
 * driven through the scripted backend the dev build uses: streamed steps and
 * text, cites and sources, result cards, proposal → confirm → TaskSummary
 * with the server's values, follow-ups, missing details, no information,
 * the 15 s fallback, a reply that fails part-way, Stop keeping the partial.
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
// A fresh Idempotency-Key per intent (the shared stub answers one constant).
const mockUuid = { next: 0 }
jest.mock('expo-crypto', () => ({ randomUUID: () => `00000000-0000-4000-8000-${String(++mockUuid.next).padStart(12, '0')}` }))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => true }))

import AssistantRoute from '@/app/assistant'

import { callsTo, installBackend, renderAssistant, resetAssistantSpecState, settle, syncTanstackNotifications } from './assistant-harness'

syncTanstackNotifications()

beforeEach(() => {
  resetAssistantSpecState()
  mockRouter.push.mockReset()
})

async function ask(view: Awaited<ReturnType<typeof renderAssistant>>, text: string) {
  await waitFor(() => expect(view.getByLabelText('Tin nhắn cho GoGo AI')).toBeTruthy())
  await act(async () => {
    await fireEvent.changeText(view.getByLabelText('Tin nhắn cho GoGo AI'), text)
  })
  await waitFor(() => expect(view.getByRole('button', { name: 'Gửi' })).toBeEnabled())
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Gửi' }))
  })
}

/**
 * The reply has ended: Send is back where Stop was. Typing and Stop are also
 * absent before the turn reaches the thread, so scripted time moves first.
 */
async function replyEnded(view: Awaited<ReturnType<typeof renderAssistant>>, timeout = 1000) {
  await settle()
  await waitFor(
    () => {
      expect(view.queryByTestId('assistant-typing')).toBeNull()
      expect(view.queryByTestId('assistant-stop')).toBeNull()
    },
    { timeout },
  )
  await settle()
}

it('a sourced answer: the question in an accent bubble, the list, cites, sources and follow-ups, announced politely', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions')
  installBackend({ seed: false })
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'Kế hoạch nhóm hoạt động thế nào?')
  await replyEnded(view)
  expect(view.getByLabelText('Bạn: Kế hoạch nhóm hoạt động thế nào?')).toBeTruthy()
  expect(view.getByText(/Mọi người cùng chọn, rồi chủ phòng chốt kế hoạch/)).toBeTruthy()
  expect(view.getAllByLabelText('Nguồn 1').length).toBeGreaterThan(0)
  const sources = within(view.getByTestId('assistant-sources'))
  expect(sources.getByText('GoGo guide · Kế hoạch')).toBeTruthy()
  expect(sources.getByText('GoGo guide · Phòng')).toBeTruthy()
  expect(view.getByRole('button', { name: 'Hỏi tiếp Mã mời dùng được bao lâu?' })).toBeTruthy()
  expect(view.getByText('Hoặc tự nhập câu trả lời.')).toBeTruthy()
  expect(announce).toHaveBeenCalledWith(expect.stringMatching(/^GoGo AI trả lời: Mọi người cùng chọn/), { queue: true })
  announce.mockRestore()
})

it('while generating: the step, Send turns into Stop, and Stop keeps what was written', async () => {
  // Real time for this one: the long reply streams for seconds.
  const backend = installBackend({ seed: false, speed: 1 })
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'Giải thích trả lời dài về ngân sách')
  await waitFor(() => expect(view.getByText('Đang xem hướng dẫn GoGo…')).toBeTruthy(), { timeout: 3000 })
  expect(view.getByText('Dừng sẽ giữ phần đã viết.')).toBeTruthy()
  await waitFor(() => expect(view.getByText(/Ngân sách theo/)).toBeTruthy(), { timeout: 3000 })
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Dừng' }))
  })
  await waitFor(() => expect(view.getByText('Đã dừng. Phần đã viết được giữ lại.')).toBeTruthy())
  expect(view.getByText(/Ngân sách theo/)).toBeTruthy()
  expect(callsTo(backend, 'stopMessage')).toHaveLength(1)
  expect(view.getByRole('button', { name: 'Gửi' })).toBeTruthy()
  await settle(400)
})

it('place results as cards with verified facts, and the place-data source', async () => {
  installBackend({ seed: false })
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'Tìm quán cà phê yên tĩnh')
  await replyEnded(view)
  const card = within(view.getByTestId('assistant-card-1b2c3d4e-0000-4000-8000-000000000001'))
  expect(card.getByText('Nhà Lá Café')).toBeTruthy()
  expect(card.getByText('45k–90k / người')).toBeTruthy()
  expect(card.getByText('Đang mở')).toBeTruthy()
  expect(within(view.getByTestId('assistant-card-1b2c3d4e-0000-4000-8000-000000000002')).getByText('Đang đóng')).toBeTruthy()
  expect(view.getByText(/Từ dữ liệu địa điểm GoGo · Kiểm tra lần cuối/)).toBeTruthy()
  await act(async () => {
    await fireEvent.press(card.getByRole('button', { name: 'Xem địa điểm' }))
  })
  expect(mockRouter.push).toHaveBeenCalledWith('/places/1b2c3d4e-0000-4000-8000-000000000001')
})

it('a write waits for the ConfirmationCard; confirming shows the TaskSummary with what the server saved', async () => {
  const backend = installBackend({ seed: false })
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'Tạo kế hoạch cho hai đứa thứ Bảy lúc 8 giờ tối')
  await replyEnded(view)
  expect(view.getByText('Xem lại trước khi lưu')).toBeTruthy()
  expect(view.getByText('Kế hoạch cho hai người')).toBeTruthy()
  expect(view.getByText('Giờ kết thúc do GoGo AI tự đặt')).toBeTruthy()
  expect(view.getByText('Chưa có gì được lưu cho đến khi bạn chạm Tạo kế hoạch.')).toBeTruthy()
  // The place row names the place from the card in the same reply.
  expect(view.getAllByText('Nhà Lá Café').length).toBeGreaterThanOrEqual(2)
  expect(callsTo(backend, 'confirmProposal')).toHaveLength(0)

  // Change the assumed budget before confirming: only the edit is sent.
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Đổi Ngân sách' }))
  })
  await act(async () => {
    await fireEvent.changeText(view.getByLabelText('Số tiền (VND)'), '400000')
  })
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Lưu' }))
  })
  await waitFor(() => expect(view.getByText('Tổng 400k')).toBeTruthy())

  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Tạo kế hoạch' }))
  })
  await waitFor(() => expect(view.getByTestId('assistant-task-summary')).toBeTruthy())
  const [proposalId, values, key] = callsTo(backend, 'confirmProposal')[0]!
  expect(typeof proposalId).toBe('string')
  expect(values).toEqual({ budgetAmount: 400000, budgetMode: 'total' })
  expect(typeof key).toBe('string')
  const summary = within(view.getByTestId('assistant-task-summary'))
  expect(summary.getByText('Đã tạo kế hoạch')).toBeTruthy()
  expect(summary.getByText('Tổng 400k')).toBeTruthy()
  await act(async () => {
    await fireEvent.press(summary.getByRole('button', { name: 'Mở kế hoạch' }))
  })
  expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/room\//))
  await settle()
})

it('"Not now" dismisses the proposal and nothing is written', async () => {
  const backend = installBackend({ seed: false })
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'make a plan for saturday')
  await replyEnded(view)
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Để sau' }))
  })
  await waitFor(() => expect(view.getByText('Chưa tạo. Bạn có thể hỏi lại bất cứ lúc nào.')).toBeTruthy())
  expect(callsTo(backend, 'confirmProposal')).toHaveLength(0)
  expect(callsTo(backend, 'dismissProposal')).toHaveLength(1)
  await settle()
})

it('missing details: two labelled groups of quick answers; a tap sends it as the next message', async () => {
  const backend = installBackend({ seed: false })
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'Lên kế hoạch ăn tối cho nhóm thứ Sáu')
  await replyEnded(view)
  expect(view.getByText('Bao nhiêu người, tính cả bạn?')).toBeTruthy()
  expect(view.getByText('Ngân sách mỗi người')).toBeTruthy()
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Bao nhiêu người, tính cả bạn? 4' }))
  })
  await replyEnded(view)
  expect(callsTo(backend, 'sendMessage').map(call => (call[1] as { text: string }).text)).toEqual(['Lên kế hoạch ăn tối cho nhóm thứ Sáu', '4'])
  // Follow-ups stay only under the latest reply.
  expect(view.queryByText('Bao nhiêu người, tính cả bạn?')).toBeNull()
})

it('no information: says so, never guesses, and offers next steps', async () => {
  installBackend({ seed: false })
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'GoGo có chương trình điểm thưởng không?')
  await replyEnded(view)
  expect(view.getByText('Không tìm thấy thông tin')).toBeTruthy()
  expect(view.getByText('Hướng dẫn của GoGo không nhắc tới điều này, nên mình sẽ không đoán.')).toBeTruthy()
  expect(view.getByRole('button', { name: 'Bạn cũng có thể GoGo làm được gì?' })).toBeTruthy()
})

it('no text in time: the fallback notice and fixed next steps, including asking again', async () => {
  const backend = installBackend({ seed: false })
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'Câu này trả lời chậm')
  await replyEnded(view)
  expect(view.getByText('GoGo AI trả lời quá lâu')).toBeTruthy()
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Hỏi lại' }))
  })
  await waitFor(() => expect(callsTo(backend, 'sendMessage')).toHaveLength(2))
  expect((callsTo(backend, 'sendMessage')[1]![1] as { text: string }).text).toBe('Câu này trả lời chậm')
  await settle()
})

it('a reply that fails part-way keeps the partial text and says so as an alert', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
  installBackend({ seed: false })
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'Cái này bị lỗi')
  await replyEnded(view)
  expect(view.getByText(/Để bình chọn, bạn mở kế hoạch/)).toBeTruthy()
  expect(view.getByText('Câu trả lời bị dừng giữa chừng')).toBeTruthy()
  expect(announce).toHaveBeenCalledWith(expect.stringContaining('Câu trả lời bị dừng giữa chừng'))
  announce.mockRestore()
  // The status refetch a finished reply triggers lands inside act (it flaked under a loaded full run).
  await settle()
})

it('a dropped stream resumes from the last frame and the reply arrives whole', async () => {
  const backend = installBackend({ seed: false })
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'test rớt mạng giữa chừng')
  // The resume waits out the first backoff step (1 s).
  await waitFor(() => expect(view.getByText('Đang kết nối lại…')).toBeTruthy())
  await replyEnded(view, 4000)
  expect(view.getByText(/Mã mời dùng được trong 7 ngày/)).toBeTruthy()
  const streams = callsTo(backend, 'openStream') as [{ lastEventId: string | null }][]
  expect(streams.length).toBe(2)
  expect(streams[1]![0].lastEventId).toMatch(/:3$/)
  // No frame was applied twice.
  expect(view.getAllByText(/Mã mời dùng được trong 7 ngày/)).toHaveLength(1)
})

it('a reply cut short (done{truncated}): the partial text stays, unfinished cards go, "cut short" is a polite status, and Retry is a new send', async () => {
  const polite = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions')
  const alert = jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
  const backend = installBackend({ seed: false })
  const view = await renderAssistant(<AssistantRoute />)
  await ask(view, 'Quán cà phê gần đây, câu này bị cắt')
  await replyEnded(view)
  expect(view.getByText(/Mình tìm được vài quán cà phê mở khuya/)).toBeTruthy()
  expect(view.getByText('Câu trả lời bị cắt ngắn')).toBeTruthy()
  // The card that had not finished is discarded, never half-shown; follow-ups too.
  expect(view.queryByText('Nhà Lá Café')).toBeNull()
  expect(view.queryByRole('button', { name: /^Hỏi tiếp/ })).toBeNull()
  expect(polite).toHaveBeenCalledWith(expect.stringMatching(/^Câu trả lời bị cắt ngắn\. GoGo AI trả lời: Mình tìm được/), { queue: true })
  expect(alert).not.toHaveBeenCalledWith(expect.stringContaining('bị cắt ngắn'))
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Thử lại' }))
  })
  await waitFor(() => expect(callsTo(backend, 'sendMessage')).toHaveLength(2))
  const sends = callsTo(backend, 'sendMessage') as [string, { text: string }, string][]
  // The same question, as a new send: a fresh Idempotency-Key, the same conversation.
  expect(sends[1]![1].text).toBe('Quán cà phê gần đây, câu này bị cắt')
  expect(sends[1]![2]).not.toBe(sends[0]![2])
  expect(sends[1]![0]).toBe(sends[0]![0])
  polite.mockRestore()
  alert.mockRestore()
  await settle()
})
