import { fireEvent, within } from '@testing-library/react-native'
import { Linking, Platform } from 'react-native'

import PermissionsSettingsScreen from '@/features/settings/permissions.view'
import { DevicePromotionsSection } from '@/features/settings/device-promotions.view'
import { ThemeScopeProvider } from '@/shared/ui/scoped-theme'
import { themes } from '@/shared/ui/theme'
import { renderScreen } from './harness'

const mockSession = { status: 'user' }
const mockLocation = { status: 'denied', granted: false }
const mockPromotions = { read: 'loaded', answer: 'accepted', enabled: true, save: 'saved' }
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => mockSession }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useFocusEffect: (effect: () => void) => {
    const { useEffect } = jest.requireActual('react')
    useEffect(effect, [effect])
  },
}))
jest.mock('expo-location', () => ({ getForegroundPermissionsAsync: async () => mockLocation }))
jest.mock('@/shared/api', () => ({
  useNotificationSettings: () => ({ data: { pushEnabled: true }, isPending: false }),
  useSetNotificationSettings: () => ({ mutate: jest.fn() }),
}))
jest.mock('@/shared/notifications/permission-bootstrap', () => ({
  pushPermission: { status: async () => 'askable' },
}))
jest.mock('@/shared/notifications/identity-bootstrap', () => ({ pushIdentity: {} }))
jest.mock('@/shared/notifications/device-promotions-store', () => ({
  devicePromotionsStore: {
    load: jest.fn(), subscribe: () => () => undefined, snapshot: () => mockPromotions,
  },
}))
jest.mock('@/shared/acquisition/bootstrap', () => ({ acquisitionConfigured: () => false }))

const realOS = Platform.OS
beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles'), 'ScopedTheme').mockImplementation(({ children }) => <>{children}</>)
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
  mockSession.status = 'user'
  mockLocation.status = 'denied'
  mockLocation.granted = false
  jest.spyOn(Linking, 'openSettings').mockResolvedValue()
})
afterEach(() => {
  jest.restoreAllMocks()
  Object.defineProperty(Platform, 'OS', { configurable: true, value: realOS })
})

it.each([
  ['orange', 'user', 'denied'], ['orangeDark', 'user', 'granted'],
  ['orange', 'anonymous', 'granted'], ['orangeDark', 'anonymous', 'denied'],
] as const)('%s / %s / location %s: one system section with tracking before its single settings button', async (theme, status, location) => {
  mockSession.status = status
  mockLocation.status = location
  mockLocation.granted = location === 'granted'
  const view = await renderScreen(<ThemeScopeProvider name={theme}><PermissionsSettingsScreen /></ThemeScopeProvider>)
  const section = within(view.getByTestId('permissions-system-section'))
  expect(section.getAllByRole('header')).toHaveLength(1)
  expect(section.getByRole('header', { name: 'Cài đặt hệ thống' })).toHaveStyle({ textTransform: 'none' })
  expect(view.queryByRole('header', { name: 'Dữ liệu phân tích & cài đặt' })).toBeNull()
  expect(view.queryByRole('header', { name: 'Liên kết hệ thống' })).toBeNull()
  const card = within(section.getByTestId('permissions-system-card'))
  const content = card.getAllByText(/Đo lượt cài đặt|Mở cài đặt hệ thống/)
  expect(content.map(node => node.props.children)).toEqual(['Đo lượt cài đặt', 'Mở cài đặt hệ thống'])
  expect(card.getAllByRole('button', { name: 'Mở cài đặt hệ thống' })).toHaveLength(1)
  const controls = view.getAllByRole('button', { name: /Mở cài đặt/ })
  expect(controls).toHaveLength(1)
  expect(view.getByRole('button', { name: 'Mở cài đặt hệ thống' })).toBeTruthy()
  expect(view.getAllByText('Đổi trong cài đặt máy.')).toHaveLength(3)
  for (const hint of view.getAllByText('Đổi trong cài đặt máy.')) {
    expect(hint).toHaveStyle({ color: themes[theme].text.secondary })
  }
  await fireEvent.press(controls[0])
  expect(Linking.openSettings).toHaveBeenCalledTimes(1)
})

it.each(['android', 'web'])('%s keeps the shared settings action', async os => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
  const view = await renderScreen(<PermissionsSettingsScreen />)
  const section = within(view.getByTestId('permissions-system-section'))
  expect(section.getByRole('header', { name: 'Cài đặt hệ thống' })).toBeTruthy()
  const controls = view.getAllByRole('button', { name: /Mở cài đặt/ })
  expect(controls).toHaveLength(1)
  await fireEvent.press(controls[0])
  expect(Linking.openSettings).toHaveBeenCalledTimes(1)
})

it('keeps the bottom failure message and clears it on a successful retry', async () => {
  jest.spyOn(Linking, 'openSettings').mockRejectedValueOnce(new Error('unavailable'))
  const view = await renderScreen(<PermissionsSettingsScreen />)
  await fireEvent.press(view.getByRole('button', { name: 'Mở cài đặt hệ thống' }))
  expect(view.getByText(/Không mở được cài đặt/)).toBeTruthy()
  await fireEvent.press(view.getByRole('button', { name: 'Mở cài đặt hệ thống' }))
  expect(view.queryByText(/Không mở được cài đặt/)).toBeNull()
})

it('standalone device promotions keeps its settings button', async () => {
  const view = await renderScreen(<DevicePromotionsSection />)
  await fireEvent.press(view.getByRole('button', { name: 'Mở cài đặt thông báo' }))
  expect(Linking.openSettings).toHaveBeenCalledTimes(1)
  expect(view.queryByText('Đổi trong cài đặt máy.')).toBeNull()
})
