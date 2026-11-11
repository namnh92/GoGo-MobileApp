import { act, fireEvent, waitFor, within } from '@testing-library/react-native'

/**
 * GoGo-MobileApp#378 (AI-APP-001) — History (design `ScreenHistory`): the
 * account's conversations grouped Today / Yesterday / Earlier, search with
 * the match marked, Rename in a sheet, Delete behind a dialog that names the
 * conversation, New chat, and opening one back into the thread.
 */

const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true }
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn(),
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'u1' } }),
}))
jest.mock('@/shared/api/queries/use-online-status', () => ({ useOnlineStatus: () => true }))

import AssistantRoute from '@/app/assistant'

import { setAssistantBackend } from '@/shared/api/assistant-backend'
import { createMockAssistantBackend } from '@/data/assistant/mock-backend'

import { callsTo, installBackend, renderAssistant, resetAssistantSpecState, settle, spyOn, syncTanstackNotifications } from './assistant-harness'

syncTanstackNotifications()

beforeEach(() => resetAssistantSpecState())

type View = Awaited<ReturnType<typeof renderAssistant>>

async function openHistory(view: View) {
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Lịch sử trò chuyện' }))
  })
  await waitFor(() => expect(view.getByTestId('assistant-history-list')).toBeTruthy())
}

it('groups by the last message: Today, Yesterday, Earlier', async () => {
  installBackend()
  const view = await renderAssistant(<AssistantRoute />)
  await openHistory(view)
  expect(view.getByText('Cuộc trò chuyện')).toBeTruthy()
  const headers = view.getAllByRole('header').map(node => node.props.children)
  expect(headers).toEqual(expect.arrayContaining(['Hôm nay', 'Hôm qua', 'Trước đó']))
  expect(view.getByText('Quán cà phê yên tĩnh ở Quận 3')).toBeTruthy()
  expect(view.getByText('Đổi màu chủ đề')).toBeTruthy()
  await settle()
})

it('search matches titles and messages, counts them, and marks the match', async () => {
  const backend = installBackend()
  const view = await renderAssistant(<AssistantRoute />)
  await openHistory(view)
  await act(async () => {
    await fireEvent.changeText(view.getByLabelText('Tìm cuộc trò chuyện'), 'chủ phòng')
  })
  await waitFor(() => expect(view.getByText('2 cuộc trò chuyện')).toBeTruthy(), { timeout: 2000 })
  expect(callsTo(backend, 'listConversations').at(-1)![0]).toMatchObject({ q: 'chủ phòng' })
  expect(view.getAllByText('chủ phòng').length).toBeGreaterThan(0)
  await act(async () => {
    await fireEvent.changeText(view.getByLabelText('Tìm cuộc trò chuyện'), 'không có gì như vậy')
  })
  await waitFor(() => expect(view.getByText('Không có cuộc trò chuyện phù hợp')).toBeTruthy(), { timeout: 2000 })
  await settle()
})

it('rename: the menu, a sheet with the name, Save once it changed', async () => {
  const backend = installBackend()
  const view = await renderAssistant(<AssistantRoute />)
  await openHistory(view)
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Thêm tuỳ chọn cho Kế hoạch nhóm bạn' }))
  })
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Đổi tên' }))
  })
  // The sheet opens once the menu has gone (acceptance BUG3).
  const input = await waitFor(() => view.getByTestId('assistant-rename-input'))
  expect(input.props.value).toBe('Kế hoạch nhóm bạn')
  expect(view.getByRole('button', { name: 'Lưu' })).toBeDisabled()
  await act(async () => {
    await fireEvent.changeText(input, 'Đi chơi cả nhóm')
  })
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Lưu' }))
  })
  await waitFor(() => expect(view.getByText('Đi chơi cả nhóm')).toBeTruthy())
  expect(callsTo(backend, 'renameConversation')[0]![1]).toBe('Đi chơi cả nhóm')
  await settle()
})

it('delete asks first, naming the conversation, and removes it', async () => {
  const backend = installBackend()
  const view = await renderAssistant(<AssistantRoute />)
  await openHistory(view)
  // A long press opens the same menu as ⋯.
  await act(async () => {
    await fireEvent(view.getByRole('button', { name: /^Mã mời không dùng được,/ }), 'longPress')
  })
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Xoá' }))
  })
  await waitFor(() => expect(view.getByText('Xoá cuộc trò chuyện này?')).toBeTruthy())
  expect(view.getByText('“Mã mời không dùng được” sẽ bị xoá khỏi lịch sử. Không thể hoàn tác.')).toBeTruthy()
  expect(callsTo(backend, 'deleteConversation')).toHaveLength(0)
  await act(async () => {
    await fireEvent.press(view.getAllByRole('button', { name: 'Xoá' }).at(-1)!)
  })
  await waitFor(() => expect(view.queryByText('Mã mời không dùng được')).toBeNull())
  expect(callsTo(backend, 'deleteConversation')).toHaveLength(1)
  await settle()
})

it('opening a conversation shows its thread; New chat goes back to Welcome', async () => {
  installBackend()
  const view = await renderAssistant(<AssistantRoute />)
  await openHistory(view)
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: /^Đổi màu chủ đề,/ }))
  })
  await waitFor(() => expect(view.getByText('Có bốn màu trong Cài đặt.')).toBeTruthy())
  expect(within(view.getByTestId('assistant-thread')).getByLabelText('Bạn: Đổi màu chủ đề ở đâu?')).toBeTruthy()
  expect(view.queryByTestId('assistant-new-chat')).toBeNull()
  expect(view.queryByRole('button', { name: 'Cuộc trò chuyện mới' })).toBeNull()
  await openHistory(view)
  await act(async () => {
    await fireEvent.press(view.getByTestId('assistant-history-new-chat'))
  })
  expect(view.getByTestId('assistant-welcome')).toBeTruthy()
  await settle()
})

it('previews are plain text: no `**` or `[n]` drawn or read aloud (acceptance minor item)', async () => {
  const mock = createMockAssistantBackend({ speed: 0, actor: () => 'user' })
  const backend = spyOn({
    ...mock,
    listConversations: async query => {
      const page = await mock.listConversations(query)
      return {
        ...page,
        items: page.items.map((item, index) =>
          index === 0 ? { ...item, preview: 'Chọn **Tổng nhóm** để chia đều.[1]\n- Mỗi người góp như nhau [2]' } : item,
        ),
      }
    },
  })
  setAssistantBackend(backend)
  const view = await renderAssistant(<AssistantRoute />)
  await settle()
  await openHistory(view)
  await waitFor(() => expect(view.getByText('Chọn Tổng nhóm để chia đều. Mỗi người góp như nhau')).toBeTruthy())
  expect(view.getByText('Chọn Tổng nhóm để chia đều. Mỗi người góp như nhau')).toBeTruthy()
  const rows = view.getAllByRole('button').filter(node => typeof node.props.accessibilityLabel === 'string')
  for (const row of rows) {
    expect(row.props.accessibilityLabel).not.toMatch(/\*\*|\[\d+\]/)
  }
  await settle()
})

it('the header keeps its title: New chat is a card under it, named in full on screen and for VoiceOver', async () => {
  installBackend()
  const view = await renderAssistant(<AssistantRoute />)
  await openHistory(view)
  const button = view.getByTestId('assistant-history-new-chat')
  expect(button.props.accessibilityLabel).toBe('Cuộc trò chuyện mới')
  expect(within(button).getByText('Cuộc trò chuyện mới')).toBeTruthy()
  await settle()
})


it('a stored reply that was cut short shows the same notice and Retry when the conversation is reopened', async () => {
  const mock = createMockAssistantBackend({ speed: 0, actor: () => 'user' })
  // The server persisted this reply as `truncated` (2.0.0-alpha.3): partial text, no cards.
  const backend = spyOn({
    ...mock,
    listMessages: async (conversationId, query) => {
      const page = await mock.listMessages(conversationId, query)
      return {
        ...page,
        items: page.items.map(item => (item.text === 'Có bốn màu trong Cài đặt.' ? { ...item, status: 'truncated' as const } : item)),
      }
    },
  })
  setAssistantBackend(backend)
  const view = await renderAssistant(<AssistantRoute />)
  await openHistory(view)
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: /^Đổi màu chủ đề,/ }))
  })
  await waitFor(() => expect(view.getByText('Có bốn màu trong Cài đặt.')).toBeTruthy())
  expect(view.getByText('Câu trả lời bị cắt ngắn')).toBeTruthy()
  await act(async () => {
    await fireEvent.press(view.getByRole('button', { name: 'Thử lại' }))
  })
  await waitFor(() => expect(callsTo(backend, 'sendMessage')).toHaveLength(1))
  expect((callsTo(backend, 'sendMessage')[0]![1] as { text: string }).text).toBe('Đổi màu chủ đề ở đâu?')
  await settle()
})
