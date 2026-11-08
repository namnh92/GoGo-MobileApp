let mockSubmissions = { data: { pages: [{ items: [] as { id: string }[], nextCursor: null as string | null }] }, isPending: false, isError: false }
const mockSubmissionEnabled = jest.fn()
jest.mock('@/shared/api/queries/use-my-place-submissions', () => ({ useMyPlaceSubmissions: (enabled: boolean) => { mockSubmissionEnabled(enabled); return mockSubmissions } }))
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import i18n from '@/shared/i18n'
import { StyleSheet } from 'react-native'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import { themes } from '@/shared/ui/theme'

let mockUnread = { count: 8, more: true }
const mockPush = jest.fn()
const mockSignOut = jest.fn()
const mockSession = { status: 'user' }
const mockUseMyRooms = jest.fn()
let mockRooms = { data: { pages: [{ items: [] as { id: string }[], nextCursor: null as string | null }] }, isPending: false, isError: false, hasNextPage: false }
const mockProfile = { displayName: 'An', homeAdministrativeArea: { provinceName: 'Hà Nội' }, interests: { mood: ['chill', 'unknown'] } }
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ session: { kind: mockSession.status, userId: 'u' }, status: mockSession.status, signOut: mockSignOut }) }))
jest.mock('@/features/notifications/unread-count', () => ({ useUnreadInbox: () => mockUnread }))
jest.mock('@/shared/api', () => ({
  useMe: () => ({ data: mockProfile }),
  useSaved: () => ({ data: [{}, {}] }), useMyReviews: () => ({ data: [] }), useNotificationSettings: () => ({}),
  useTaxonomies: () => ({ data: { kinds: { mood: [{ key: 'chill', labels: { vi: 'Thư giãn' } }] } } }),
  useMyRooms: (options: { status?: string; enabled?: boolean }) => {
    mockUseMyRooms(options)
    return options.status ? { data: { pages: [] }, hasNextPage: false } : mockRooms
  },
}))
import ProfileScreen from '@/features/tabs/profile.view'

beforeEach(() => {
  mockSubmissions = { data: { pages: [{ items: [], nextCursor: null }] }, isPending: false, isError: false }
  mockSubmissionEnabled.mockClear()
  mockUnread = { count: 8, more: true }
  mockSession.status = 'user'
  mockPush.mockReset()
  mockSignOut.mockReset()
  mockUseMyRooms.mockClear()
  mockRooms = { data: { pages: [{ items: [], nextCursor: null }] }, isPending: false, isError: false, hasNextPage: false }
})
it.each(['user', 'guest'])('%s: shows zero rooms and still opens upcoming', async status => {
  mockSession.status = status
  await render(<ProfileScreen />)
  expect(mockUseMyRooms).toHaveBeenCalledWith({ enabled: true })
  const shortcut = screen.getByRole('button', { name: 'Kèo: 0' })
  expect(screen.queryByText('—')).toBeNull()
  await fireEvent.press(shortcut)
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/plans', params: { showUpcoming: expect.any(String) } })
})
it('shows an exact count when the single page is complete', async () => {
  mockRooms.data.pages = [{ items: [{ id: 'a' }, { id: 'b' }], nextCursor: null }]
  await render(<ProfileScreen />)
  expect(screen.getByRole('button', { name: 'Kèo: 2' })).toBeTruthy()
})
it('shows a lower bound while a nextCursor exists and becomes exact after the final page', async () => {
  mockRooms.data.pages = [{ items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'next' }]
  mockRooms.hasNextPage = true
  const view = await render(<ProfileScreen />)
  expect(screen.getByRole('button', { name: 'Kèo: 2+' })).toBeTruthy()
  mockRooms.data.pages.push({ items: [{ id: 'b' }, { id: 'c' }], nextCursor: 'last' })
  await view.rerender(<ProfileScreen />)
  expect(screen.getByRole('button', { name: 'Kèo: 3+' })).toBeTruthy()
  mockRooms.data.pages.push({ items: [{ id: 'd' }], nextCursor: null })
  mockRooms.hasNextPage = false
  await view.rerender(<ProfileScreen />)
  expect(screen.getByRole('button', { name: 'Kèo: 4' })).toBeTruthy()
})
it('hides the number on error, including when stale data remains, and keeps navigation', async () => {
  mockRooms.isError = true
  mockRooms.data.pages = [{ items: [{ id: 'a' }], nextCursor: null }]
  await render(<ProfileScreen />)
  const shortcut = screen.getByRole('button', { name: 'Kèo' })
  expect(screen.queryByRole('button', { name: /^Kèo:/ })).toBeNull()
  expect(screen.queryByText('—')).toBeNull()
  expect(screen.queryByTestId('profile-keo-loading')).toBeNull()
  await fireEvent.press(shortcut)
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/plans', params: { showUpcoming: expect.any(String) } })
})
it('shows a skeleton while loading and then replaces it with zero', async () => {
  mockRooms.isPending = true
  mockRooms.data.pages = []
  const view = await render(<ProfileScreen />)
  expect(screen.getByTestId('profile-keo-loading')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Kèo' }).props.accessibilityState.busy).toBe(true)
  expect(screen.queryByRole('button', { name: /^Kèo:/ })).toBeNull()
  mockRooms.isPending = false
  mockRooms.data.pages = [{ items: [], nextCursor: null }]
  await view.rerender(<ProfileScreen />)
  expect(screen.queryByTestId('profile-keo-loading')).toBeNull()
  expect(screen.getByRole('button', { name: 'Kèo: 0' })).toBeTruthy()
})
it('anonymous: disables the room query and omits cached counts', async () => {
  mockSession.status = 'anonymous'
  mockRooms.data.pages = [{ items: [{ id: 'a' }], nextCursor: null }]
  await render(<ProfileScreen />)
  expect(mockUseMyRooms).toHaveBeenCalledWith({ enabled: false })
  expect(screen.getByRole('button', { name: 'Kèo' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^Kèo:/ })).toBeNull()
})
it('shows only real profile fields, resolved interests and full saved/review counts', async () => {
  await render(<ProfileScreen />)
  expect(screen.getByText('An')).toBeTruthy()
  expect(screen.getByText('Thư giãn')).toBeTruthy()
  expect(screen.queryByText('unknown')).toBeNull()
  expect(screen.getByRole('button', { name: 'Đã lưu: 2' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Đánh giá: 0' })).toBeTruthy()
  expect(screen.getByTestId('profile-setting-Đóng góp của tôi')).toBeTruthy()
  expect(screen.getByTestId('profile-bell').props.accessibilityLabel).toBe('Thông báo, 8+ chưa đọc')
  expect(screen.getByTestId('profile-unread')).toBeTruthy()
})
it('guests have a sign-in card, locks with a reason and CTA, and accessible local theme settings', async () => {
  mockSession.status = 'guest'
  await render(<ProfileScreen />)
  expect(screen.getByRole('button', { name: 'Đăng nhập / Đăng ký' })).toBeTruthy()
  expect(screen.queryByText('An')).toBeNull()
  await fireEvent.press(screen.getByTestId('profile-setting-Màu chủ đề'))
  expect(mockPush).toHaveBeenCalledWith('/settings/theme')
  mockPush.mockReset()
  await fireEvent.press(screen.getByRole('button', { name: 'Đã lưu' }))
  expect(mockPush).not.toHaveBeenCalled()
  expect(screen.getByTestId('result-sheet')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Đăng nhập' }))
  expect(mockPush).toHaveBeenCalledWith('/auth/sign-in')
})
it('logout asks first and cancel leaves the session intact', async () => {
  await render(<ProfileScreen />)
  await fireEvent.press(screen.getByRole('button', { name: 'Đăng xuất tài khoản' }))
  expect(mockSignOut).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'Huỷ' }))
  expect(mockSignOut).not.toHaveBeenCalled()
})
it('does not carry an open confirmation across account switches', async () => {
  const view = await render(<ProfileScreen />)
  await fireEvent.press(screen.getByRole('button', { name: 'Đăng xuất tài khoản' }))
  mockSession.status = 'guest'
  await view.rerender(<ProfileScreen />)
  mockSession.status = 'user'
  await view.rerender(<ProfileScreen />)
  expect(screen.queryByText('Xác nhận')).toBeNull()
  expect(mockSignOut).not.toHaveBeenCalled()
})

it('uses shared unread updates and routes the bell to the inbox', async () => {
  const view = await render(<ProfileScreen />)
  expect(screen.getByTestId('profile-unread')).toBeTruthy()
  await fireEvent.press(screen.getByTestId('profile-bell'))
  expect(mockPush).toHaveBeenCalledWith('/notifications')
  mockUnread = { count: 0, more: false }
  await view.rerender(<ProfileScreen />)
  expect(screen.queryByTestId('profile-unread')).toBeNull()
  expect(screen.getByTestId('profile-bell').props.accessibilityLabel).toBe('Thông báo')
})

it('shows a zero contribution count and links each contribution segment explicitly', async () => {
  await render(<ProfileScreen />)
  expect(mockSubmissionEnabled).toHaveBeenCalledWith(true)
  await fireEvent.press(screen.getByRole('button', { name: 'Đóng góp: 0' }))
  expect(mockPush).toHaveBeenLastCalledWith('/me/contributions?tab=places')
  await fireEvent.press(screen.getByRole('button', { name: 'Đánh giá: 0' }))
  expect(mockPush).toHaveBeenLastCalledWith('/me/contributions?tab=reviews')
})
it('counts unique submissions across pages with a lower bound until the final page', async () => {
  mockSubmissions.data.pages = [{ items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'next' }]
  const view = await render(<ProfileScreen />)
  expect(screen.getByRole('button', { name: 'Đóng góp: 2+' })).toBeTruthy()
  mockSubmissions.data.pages.push({ items: [{ id: 'b' }, { id: 'c' }], nextCursor: null })
  await view.rerender(<ProfileScreen />)
  expect(screen.getByRole('button', { name: 'Đóng góp: 3' })).toBeTruthy()
})
it('hides stale contribution counts on error while keeping navigation', async () => {
  mockSubmissions.isError = true
  mockSubmissions.data.pages = [{ items: [{ id: 'a' }], nextCursor: null }]
  await render(<ProfileScreen />)
  expect(screen.queryByRole('button', { name: /^Đóng góp:/ })).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Đóng góp' }))
  expect(mockPush).toHaveBeenLastCalledWith('/me/contributions?tab=places')
})
it('shows a contribution skeleton while loading and hides cached counts for guests', async () => {
  mockSubmissions.isPending = true
  mockSubmissions.data.pages = []
  const view = await render(<ProfileScreen />)
  expect(screen.getByTestId('profile-contributions-loading')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Đóng góp' }).props.accessibilityState.busy).toBe(true)
  mockSession.status = 'guest'
  mockSubmissions.isPending = false
  mockSubmissions.data.pages = [{ items: [{ id: 'a' }], nextCursor: null }]
  await view.rerender(<ProfileScreen />)
  expect(mockSubmissionEnabled).toHaveBeenLastCalledWith(false)
  expect(screen.queryByRole('button', { name: /^Đóng góp:/ })).toBeNull()
  await fireEvent.press(screen.getByRole('button', { name: 'Đóng góp' }))
  expect(mockPush).not.toHaveBeenCalled()
  expect(screen.getByTestId('result-sheet')).toBeTruthy()
})
it.each(['orange', 'orangeDark'] as const)('balances four tiles in one row with English labels in %s', async name => {
  UnistylesSheet.configure({ themes: { [name]: themes[name] } as unknown as typeof themes })
  await act(async () => { await i18n.changeLanguage('en') })
  try {
    await render(<ProfileScreen />)
    for (const label of ['Saved: 2', 'Plans: 0', 'Reviews: 0', 'Contributions: 0']) {
      const tile = screen.getByRole('button', { name: label })
      expect(StyleSheet.flatten(tile.props.style).flex).toBe(1)
      expect(StyleSheet.flatten(tile.props.style).minWidth).toBe(0)
    }
  } finally {
    await act(async () => { await i18n.changeLanguage('vi') })
    UnistylesSheet.configure({ themes })
  }
})


it.each([
  ['vi', 'Đăng xuất tài khoản', 'Phiên trên thiết bị này sẽ kết thúc.', 'Huỷ', 'Xác nhận'],
  ['en', 'Sign out of account', 'Your session on this device will end.', 'Cancel', 'Confirm'],
])('renders %s logout copy with cancel left and confirmation right on one row', async (language, open, body, cancel, confirm) => {
  await act(async () => { await i18n.changeLanguage(language) })
  await render(<ProfileScreen />)
  await fireEvent.press(screen.getByRole('button', { name: open }))
  expect(screen.getByText(body)).toBeTruthy()
  const left = screen.getByRole('button', { name: cancel })
  const right = screen.getByRole('button', { name: confirm })
  expect(left.parent).toBe(right.parent)
  expect(StyleSheet.flatten(left.parent!.props.style).flexDirection).toBe('row')
  expect(left.parent!.children.indexOf(left)).toBeLessThan(left.parent!.children.indexOf(right))
  for (const button of [left, right]) expect(StyleSheet.flatten(button.props.style)).toMatchObject({ flex: 1, minWidth: 0 })
  expect(screen.getByText(confirm).props.numberOfLines).toBeUndefined()
  await fireEvent.press(left)
  expect(mockSignOut).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: open }))
  await fireEvent.press(screen.getByRole('button', { name: confirm }))
  expect(mockSignOut).toHaveBeenCalledTimes(1)
  await act(async () => { await i18n.changeLanguage('vi') })
})
