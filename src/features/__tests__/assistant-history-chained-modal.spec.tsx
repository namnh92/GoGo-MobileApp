import { act, fireEvent, waitFor } from '@testing-library/react-native'

/**
 * iOS acceptance BUG3 (GoGo-MobileApp#378): History "⋯" → Đổi tên / Xoá
 * closed the menu, but the rename sheet / delete dialog never appeared and
 * every later tap was ignored until the app was killed.
 *
 * The menu row closed the menu sheet and opened the next RN `Modal` in the
 * same tick. UIKit presents one modal per presenter: asked to present while
 * the menu is still up (or sliding out), it refuses ("already presenting"),
 * the second modal never shows, and its window is left catching touches.
 *
 * The default jest Modal mock renders any number of modals at once, which is
 * why the History spec never saw this. Here `Modal` is a fake presenter with
 * UIKit's rule: a sibling asked to present while another is still presented
 * is refused and stays refused; a hidden modal is dismissed a moment later,
 * and only then fires `onDismiss`.
 */

const mockPresenter = { presented: new Set<number>(), refused: [] as string[] }
jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const View = jest.requireActual('react-native/Libraries/Components/View/View').default
  let nextId = 0
  function FakeModal(props: { visible?: boolean; onDismiss?: () => void; children?: React.ReactNode; testID?: string }) {
    const id = React.useRef(++nextId).current
    const [shown, setShown] = React.useState(false)
    const onDismiss = React.useRef(props.onDismiss)
    onDismiss.current = props.onDismiss
    const visible = props.visible !== false
    React.useLayoutEffect(() => {
      if (visible && !shown) {
        if (mockPresenter.presented.size > 0) {
          // UIKit: "Attempt to present … which is already presenting". Never retried.
          mockPresenter.refused.push(String(id))
          return
        }
        mockPresenter.presented.add(id)
        setShown(true)
        return
      }
      if (!visible && shown) {
        const timer = setTimeout(() => {
          mockPresenter.presented.delete(id)
          setShown(false)
          onDismiss.current?.()
        }, 5)
        return () => clearTimeout(timer)
      }
      return undefined
    }, [visible, shown, id])
    React.useEffect(() => () => void mockPresenter.presented.delete(id), [id])
    return shown && visible ? React.createElement(View, null, props.children) : null
  }
  return { __esModule: true, default: FakeModal }
})

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

import AssistantRoute from '@/app/assistant'

import { callsTo, installBackend, renderAssistant, resetAssistantSpecState, settle, syncTanstackNotifications } from './assistant-harness'

syncTanstackNotifications()

beforeEach(() => {
  resetAssistantSpecState()
  mockPresenter.presented.clear()
  mockPresenter.refused = []
})

type View = Awaited<ReturnType<typeof renderAssistant>>

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(element)
  })
  // The native dismissal of a hidden modal lands a moment later.
  await settle(20)
}

async function openMenu(view: View, title: string) {
  await press(view.getByRole('button', { name: 'Lịch sử trò chuyện' }))
  await waitFor(() => expect(view.getByTestId('assistant-history-list')).toBeTruthy())
  await press(view.getByRole('button', { name: `Thêm tuỳ chọn cho ${title}` }))
  expect(view.getByRole('button', { name: 'Đổi tên' })).toBeTruthy()
}

it('Đổi tên: the rename sheet appears once the menu has gone, and no modal is refused', async () => {
  const backend = installBackend()
  const view = await renderAssistant(<AssistantRoute />)
  await openMenu(view, 'Kế hoạch nhóm bạn')
  await press(view.getByRole('button', { name: 'Đổi tên' }))
  await waitFor(() => expect(view.getByTestId('assistant-rename-input')).toBeTruthy())
  expect(mockPresenter.refused).toEqual([])
  // And it works: the screen is not frozen behind a refused modal.
  await act(async () => {
    await fireEvent.changeText(view.getByTestId('assistant-rename-input'), 'Đi chơi cả nhóm')
  })
  await press(view.getByRole('button', { name: 'Lưu' }))
  await waitFor(() => expect(view.getByText('Đi chơi cả nhóm')).toBeTruthy())
  expect(callsTo(backend, 'renameConversation')[0]![1]).toBe('Đi chơi cả nhóm')
  await settle()
})

it('Xoá: the confirmation dialog appears once the menu has gone, and deleting works', async () => {
  const backend = installBackend()
  const view = await renderAssistant(<AssistantRoute />)
  await openMenu(view, 'Mã mời không dùng được')
  await press(view.getByRole('button', { name: 'Xoá' }))
  await waitFor(() => expect(view.getByText('Xoá cuộc trò chuyện này?')).toBeTruthy())
  expect(mockPresenter.refused).toEqual([])
  await press(view.getAllByRole('button', { name: 'Xoá' }).at(-1)!)
  await waitFor(() => expect(view.queryByText('Mã mời không dùng được')).toBeNull())
  expect(callsTo(backend, 'deleteConversation')).toHaveLength(1)
  await settle()
})

it('closing the menu without choosing opens nothing', async () => {
  installBackend()
  const view = await renderAssistant(<AssistantRoute />)
  await openMenu(view, 'Kế hoạch nhóm bạn')
  await press(view.getAllByRole('button', { name: 'Đóng' }).at(-1)!)
  expect(view.queryByRole('button', { name: 'Đổi tên' })).toBeNull()
  expect(view.queryByTestId('assistant-rename-input')).toBeNull()
  expect(view.queryByText('Xoá cuộc trò chuyện này?')).toBeNull()
  await settle()
})
