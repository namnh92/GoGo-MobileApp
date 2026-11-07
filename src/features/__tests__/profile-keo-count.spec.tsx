import { fireEvent, render, screen } from '@testing-library/react-native'
import '@/shared/i18n'

const mockPush = jest.fn()
const mockSignOut = jest.fn()
const mockSession = { status: 'user' }
const mockProfile = { displayName: 'An', homeAdministrativeArea: { provinceName: 'Hà Nội' }, interests: { mood: ['chill', 'unknown'] } }
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ session: { kind: mockSession.status, userId: 'u' }, status: mockSession.status, signOut: mockSignOut }) }))
jest.mock('@/features/notifications/unread-count', () => ({ useUnreadInbox: () => ({ count: 8, more: true }) }))
jest.mock('@/shared/api', () => ({
  useMe: () => ({ data: mockProfile }),
  useSaved: () => ({ data: [{}, {}] }), useMyReviews: () => ({ data: [] }), useNotificationSettings: () => ({}),
  useTaxonomies: () => ({ data: { kinds: { mood: [{ key: 'chill', labels: { vi: 'Thư giãn' } }] } } }),
  useMyRooms: () => ({ data: { pages: [] }, hasNextPage: false }),
}))
import ProfileScreen from '@/features/tabs/profile.view'

beforeEach(() => { mockSession.status = 'user'; mockPush.mockReset(); mockSignOut.mockReset() })
it.each(['user', 'guest', 'anonymous'])('%s: Kèo has no unsupported total and still opens upcoming', async status => {
  mockSession.status = status
  await render(<ProfileScreen />)
  const shortcut = screen.getByRole('button', { name: 'Kèo' })
  expect(screen.queryByRole('button', { name: /^Kèo:/ })).toBeNull()
  expect(screen.queryByText('—')).toBeNull()
  await fireEvent.press(shortcut)
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(tabs)/plans', params: { showUpcoming: expect.any(String) } })
})
it('shows only real profile fields, resolved interests and full saved/review counts', async () => {
  await render(<ProfileScreen />)
  expect(screen.getByText('An')).toBeTruthy()
  expect(screen.getByText('Thư giãn')).toBeTruthy()
  expect(screen.queryByText('unknown')).toBeNull()
  expect(screen.getByRole('button', { name: 'Đã lưu: 2' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Đánh giá: 0' })).toBeTruthy()
  expect(screen.getByTestId('profile-setting-Đóng góp của tôi')).toBeTruthy()
  expect(screen.getByTestId('profile-bell').props.accessibilityLabel).toBe('Thông báo')
  expect(screen.queryByTestId('profile-unread')).toBeNull()
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
  await fireEvent.press(screen.getByRole('button', { name: 'Đăng xuất' }))
  expect(mockSignOut).not.toHaveBeenCalled()
  await fireEvent.press(screen.getByRole('button', { name: 'Huỷ' }))
  expect(mockSignOut).not.toHaveBeenCalled()
})
it('does not carry an open confirmation across account switches', async () => {
  const view = await render(<ProfileScreen />)
  await fireEvent.press(screen.getByRole('button', { name: 'Đăng xuất' }))
  mockSession.status = 'guest'
  await view.rerender(<ProfileScreen />)
  mockSession.status = 'user'
  await view.rerender(<ProfileScreen />)
  expect(screen.queryByText('Xác nhận đăng xuất')).toBeNull()
  expect(mockSignOut).not.toHaveBeenCalled()
})
