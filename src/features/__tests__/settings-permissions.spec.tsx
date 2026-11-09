import { act } from '@testing-library/react-native'
import i18n from '@/shared/i18n'
import { renderScreen } from './harness'

/**
 * APP-058 (#216) — one screen for notifications and location, reachable through
 * both earlier routes, with each half shown to the people it applies to.
 */

const mockSession = { status: 'user' as string }
jest.mock('@/features/settings/device-promotions.view', () => {
  const { Text } = jest.requireActual('react-native')
  return { DevicePromotionsSection: () => <Text>device-promotions-section</Text> }
})
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => mockSession }))
jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}))
jest.mock('@/features/notifications/notification-switch.view', () => {
  const { Text } = jest.requireActual('react-native')
  return { NotificationSwitchSection: () => <Text>notification-section</Text> }
})
jest.mock('@/features/settings/location-permission.view', () => {
  const { Text } = jest.requireActual('react-native')
  return { LocationPermissionSection: () => <Text>location-section</Text> }
})

jest.mock('@/features/settings/tracking-consent.view', () => {
  const { Text } = jest.requireActual('react-native')
  return { TrackingConsentSection: ({ footer }: { footer?: import('react').ReactNode }) => <><Text>tracking-section</Text>{footer}</> }
})

import PermissionsSettingsScreen from '@/features/settings/permissions.view'
import NotificationsRoute from '@/app/settings/notifications'
import LocationRoute from '@/app/settings/location'

beforeEach(() => {
  mockSession.status = 'user'
})

it('opens the same screen from both earlier settings routes', () => {
  expect(NotificationsRoute).toBe(PermissionsSettingsScreen)
  expect(LocationRoute).toBe(PermissionsSettingsScreen)
})

it('shows both sections under their own headers for a signed-in account', async () => {
  const view = await renderScreen(<PermissionsSettingsScreen />)
  expect(view.getByRole('header', { name: 'Quyền và dữ liệu' })).toBeTruthy()
  expect(view.getAllByRole('header').map(header => header.props.accessibilityLabel ?? header.props.children)).toEqual(['Quyền và dữ liệu', 'Quyền thiết bị', 'Cài đặt hệ thống'])
  expect(view.getByText('notification-section')).toBeTruthy()
  expect(view.queryByText('device-promotions-section')).toBeNull()
  expect(view.getByText('location-section')).toBeTruthy()
  expect(view.getByText('tracking-section')).toBeTruthy()
  expect(view.getAllByRole('button', { name: 'Mở cài đặt hệ thống' })).toHaveLength(1)
})

it('keeps location for a signed-out person and offers sign-in only for the account switch', async () => {
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
