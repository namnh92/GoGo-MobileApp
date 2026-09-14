import { renderScreen } from './harness'

/**
 * APP-058 (#216) — one screen for notifications and location, reachable through
 * both earlier routes, with each half shown to the people it applies to.
 */

const mockSession = { status: 'user' as string }
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
  expect(view.getByText('Thông báo và vị trí')).toBeTruthy()
  expect(view.getAllByRole('header').map(header => header.props.children)).toEqual(['Thông báo', 'Vị trí'])
  expect(view.getByText('notification-section')).toBeTruthy()
  expect(view.getByText('location-section')).toBeTruthy()
})

it('keeps location for a signed-out person and offers sign-in only for the account switch', async () => {
  mockSession.status = 'anonymous'
  const view = await renderScreen(<PermissionsSettingsScreen />)
  expect(view.queryByText('notification-section')).toBeNull()
  expect(view.getByText('Đăng nhập')).toBeTruthy()
  expect(view.getByText('location-section')).toBeTruthy()
})
