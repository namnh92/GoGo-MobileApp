import { act, fireEvent } from '@testing-library/react-native'
import i18n from '@/shared/i18n'
import { renderScreen } from './harness'

/**
 * APP-058 (#216) keeps device permissions; #539 moves account notification
 * controls behind one status/navigation row.
 */

const mockPermission = jest.fn()
const mockPush = jest.fn()
let mockSettings: Record<string, unknown>
jest.mock('@/shared/notifications/permission-bootstrap', () => ({ pushPermission: { status: () => mockPermission() } }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useNotificationSettings: () => mockSettings,
}))

const mockSession = { status: 'user' as string }
jest.mock('@/features/settings/device-promotions.view', () => {
  const { Text } = jest.requireActual('react-native')
  return { DevicePromotionsSection: () => <Text>device-promotions-section</Text> }
})
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => mockSession }))
jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => { jest.requireActual('react').useEffect(effect, [effect]) },
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}))
jest.mock('@/features/settings/location-permission.view', () => {
  const { Text } = jest.requireActual('react-native')
  return { LocationPermissionSection: () => <Text>location-section</Text> }
})

jest.mock('@/features/settings/tracking-consent.view', () => {
  const { Text } = jest.requireActual('react-native')
  return { TrackingConsentSection: ({ footer }: { footer?: import('react').ReactNode }) => <><Text>tracking-section</Text>{footer}</> }
})

import PermissionsSettingsScreen from '@/features/settings/permissions.view'
import PermissionsRoute from '@/app/settings/permissions'
import NotificationsRoute from '@/app/settings/notifications'
import NotificationSettingsScreen from '@/features/notifications/notification-settings.view'
import LocationRoute from '@/app/settings/location'

beforeEach(() => {
  jest.clearAllMocks()
  mockPermission.mockResolvedValue('granted')
  mockSettings = { data: { pushEnabled: true }, isPending: false, isError: false }
  mockSession.status = 'user'
})

it('keeps permissions reachable while notifications opens its dedicated group 10 screen', () => {
  expect(NotificationsRoute).toBe(NotificationSettingsScreen)
  expect(PermissionsRoute).toBe(PermissionsSettingsScreen)
  expect(LocationRoute).toBe(PermissionsSettingsScreen)
})

it('shows both sections under their own headers for a signed-in account', async () => {
  const view = await renderScreen(<PermissionsSettingsScreen />)
  expect(view.getByRole('header', { name: 'Quyền và dữ liệu' })).toBeTruthy()
  expect(view.getAllByRole('header').map(header => header.props.accessibilityLabel ?? header.props.children)).toEqual(['Quyền và dữ liệu', 'Quyền thiết bị', 'Cài đặt hệ thống'])
  expect(view.getByRole('button', { name: 'Thông báo' })).toBeTruthy()
  expect(view.queryByText('notification-section')).toBeNull()
  expect(view.queryByText('device-promotions-section')).toBeNull()
  expect(view.getByText('location-section')).toBeTruthy()
  expect(view.getByText('tracking-section')).toBeTruthy()
  expect(view.getAllByRole('button', { name: 'Mở cài đặt hệ thống' })).toHaveLength(1)
})

it('keeps location and device promotions for a signed-out person, with one notification row', async () => {
  mockSession.status = 'anonymous'
  const view = await renderScreen(<PermissionsSettingsScreen />)
  expect(view.queryByText('notification-section')).toBeNull()
  expect(view.getByText('device-promotions-section')).toBeTruthy()
  expect(view.getByText('Đăng nhập')).toBeTruthy()
  expect(view.getByText('location-section')).toBeTruthy()
})

it.each([['vi', 'Quyền và dữ liệu'], ['en', 'Permissions and data']])('renders the visible permissions title in %s', async (locale, title) => {
  await act(async () => { await i18n.changeLanguage(locale) })
  try {
    const view = await renderScreen(<PermissionsSettingsScreen />)
    const header = view.getByRole('header', { name: title })
    expect(header.props.children).toBe(title)
  } finally {
    await act(async () => { await i18n.changeLanguage('vi') })
  }
})


it('has one notification entry, no account switch, and navigates to the unified settings', async () => {
  const view = await renderScreen(<PermissionsSettingsScreen />)
  expect(view.getAllByRole('button', { name: 'Thông báo' })).toHaveLength(1)
  expect(view.queryByRole('switch', { name: 'Thông báo' })).toBeNull()
  expect(view.getByText('Đang bật')).toBeTruthy()
  await fireEvent.press(view.getByRole('button', { name: 'Thông báo' }))
  expect(mockPush).toHaveBeenCalledTimes(1)
  expect(mockPush).toHaveBeenCalledWith('/settings/notifications')
})

it.each([
  [true, 'granted', 'Đang bật'],
  [false, 'granted', 'Đang tắt'],
  [true, 'askable', 'Bị chặn trong cài đặt máy'],
  [false, 'askable', 'Bị chặn trong cài đặt máy'],
  [true, 'unknown', 'Không kiểm tra được quyền thông báo trên máy này.'],
])('shows account=%s/device=%s as %s without offering another switch', async (enabled, permission, label) => {
  mockSettings = { data: { pushEnabled: enabled } }
  mockPermission.mockResolvedValue(permission)
  const view = await renderScreen(<PermissionsSettingsScreen />)
  expect(view.getByText(label)).toBeTruthy()
  expect(view.queryByText('notification-section')).toBeNull()
})
