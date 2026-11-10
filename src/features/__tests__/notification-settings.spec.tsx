import { act, fireEvent } from '@testing-library/react-native'
import { AppState, Linking, type AppStateStatus } from 'react-native'
import { renderScreen } from './harness'
import type { NotificationSettingsResource } from '@/shared/api/endpoints/me'
import type { OpBody } from '@/shared/api/types'

/**
 * NTF-APP-010 (#215) — one switch for the account, device permission shown
 * beside it and never merged into it; reused on the unified screen (#539).
 */

const mockStatus = jest.fn()
const mockMutate = jest.fn()
type Settings = NotificationSettingsResource
let mockSettings: { data: Settings | undefined; isPending: boolean; isError: boolean; refetch: jest.Mock; isFetching?: boolean; isPaused?: boolean }
let mockSave: { mutate: jest.Mock; isPending: boolean; isError: boolean; variables?: OpBody<'patchNotificationSettings'> }
jest.mock('@/features/settings/device-promotions.view', () => {
  const { Text } = jest.requireActual('react-native')
  return { DevicePromotionsSection: () => <Text>device-promotions-section</Text> }
})
jest.mock('@/shared/notifications/permission-bootstrap', () => ({ pushPermission: { status: () => mockStatus() } }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useNotificationSettings: () => mockSettings,
  useSetNotificationSettings: () => mockSave,
}))
jest.mock('@/features/settings/location-permission.view', () => ({ LocationPermissionSection: () => null }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useFocusEffect: (effect: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect])
  },
}))
import NotificationSettings from '@/features/notifications/notification-settings.view'

const loaded = (settings: Partial<Settings> = {}) => ({
  data: { pushEnabled: true, source: 'explicit' as const, updatedAt: '2026-09-14T00:00:00Z', ...settings },
  isPending: false,
  isError: false,
  refetch: jest.fn(),
})

beforeEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
  mockSettings = loaded()
  mockSave = { mutate: mockMutate, isPending: false, isError: false }
  mockStatus.mockResolvedValue('granted')
})

it('shows exactly one switch, carrying the account value', async () => {
  const screen = await renderScreen(<NotificationSettings />)
  const switches = screen.getAllByRole('switch', { name: 'Thông báo' })
  expect(switches).toHaveLength(1)
  expect(screen.getAllByRole('switch')).toHaveLength(7)
  expect(switches[0].props.value).toBe(true)
  expect(switches[0].props.disabled).toBe(false)
  expect(screen.getByRole('switch', { name: 'Thông báo' })).toBeTruthy()
})

it('saves the choice on toggle and nothing else', async () => {
  const screen = await renderScreen(<NotificationSettings />)
  await act(async () => {
    await fireEvent(screen.getByTestId('notification-master'), 'valueChange', false)
  })
  expect(mockMutate).toHaveBeenCalledTimes(1)
  expect(mockMutate).toHaveBeenCalledWith({ pushEnabled: false })
})

it('stays off and locked while the first read runs, and retries a failed read in place', async () => {
  mockSettings = { data: undefined, isPending: true, isError: false, refetch: jest.fn() }
  const screen = await renderScreen(<NotificationSettings />)
  expect(screen.getByTestId('notification-master').props.value).toBe(false)
  expect(screen.getByTestId('notification-master').props.disabled).toBe(true)
  expect(screen.getByText('Đang tải…')).toBeTruthy()

  const refetch = jest.fn()
  mockSettings = { data: undefined, isPending: false, isError: true, refetch }
  const failed = await renderScreen(<NotificationSettings />)
  await act(async () => {
    await fireEvent.press(failed.getByText('Thử lại'))
  })
  expect(refetch).toHaveBeenCalledTimes(1)
})

it('locks the switch while a save is in flight, so a double tap sends one request', async () => {
  mockSave = { mutate: mockMutate, isPending: true, isError: false, variables: { pushEnabled: false } }
  const screen = await renderScreen(<NotificationSettings />)
  expect(screen.getByTestId('notification-master').props.disabled).toBe(true)
})

it('says a failed save was rolled back and retries the same choice', async () => {
  // The hook already restored the cached value; the screen explains it.
  mockSettings = loaded({ pushEnabled: true })
  mockSave = { mutate: mockMutate, isPending: false, isError: true, variables: { pushEnabled: false } }
  const screen = await renderScreen(<NotificationSettings />)
  expect(screen.getByTestId('notification-master').props.value).toBe(true)
  expect(screen.getByText(/Công tắc đã trở về trạng thái trước/)).toBeTruthy()
  await act(async () => {
    await fireEvent.press(screen.getByText('Thử lưu lại'))
  })
  expect(mockMutate).toHaveBeenCalledWith({ pushEnabled: false })
})

it('explains an off carried over from older per-kind choices, and only then', async () => {
  mockSettings = loaded({ pushEnabled: false, source: 'migrated' })
  const migrated = await renderScreen(<NotificationSettings />)
  expect(migrated.getByText(/trước đây bạn đã tắt ít nhất một loại thông báo/)).toBeTruthy()

  mockSettings = loaded({ pushEnabled: false, source: 'explicit' })
  const explicit = await renderScreen(<NotificationSettings />)
  expect(explicit.queryByText(/trước đây bạn đã tắt ít nhất một loại thông báo/)).toBeNull()
})

it('on a device where the OS refuses, points to Settings and never implies notifications will show', async () => {
  mockStatus.mockResolvedValue('askable')
  const screen = await renderScreen(<NotificationSettings />)
  expect(await screen.findByText(/đang tắt trong cài đặt của máy này/)).toBeTruthy()
  expect(screen.queryByText(/Máy này cho phép GoGo hiển thị thông báo/)).toBeNull()
  expect(screen.getByText('Mở cài đặt thông báo')).toBeTruthy()
  // The account preference is still the account's to change.
  expect(screen.getByTestId('notification-master').props.disabled).toBe(false)
})

it('re-reads device permission when the app returns from Settings', async () => {
  let resume: ((state: AppStateStatus) => void) | undefined
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    resume = callback
    return { remove: jest.fn() }
  })
  mockStatus.mockResolvedValue('askable')
  const screen = await renderScreen(<NotificationSettings />)
  expect(await screen.findByText(/đang tắt trong cài đặt của máy này/)).toBeTruthy()

  mockStatus.mockResolvedValue('granted')
  await act(async () => {
    resume?.('active')
  })
  expect(screen.getByText('Máy này cho phép GoGo hiển thị thông báo.')).toBeTruthy()
  expect(screen.queryByText('Mở cài đặt thông báo')).toBeNull()
})

it('does not claim the permission check failed while the first read is pending', async () => {
  let resolveStatus!: (state: 'granted') => void
  mockStatus.mockReturnValueOnce(new Promise(resolve => { resolveStatus = resolve }))
  const screen = await renderScreen(<NotificationSettings />)
  expect(screen.queryByText(/Không kiểm tra được quyền thông báo/)).toBeNull()
  expect(screen.getByText(/Đang kiểm tra quyền thông báo/)).toBeTruthy()
  await act(async () => { resolveStatus('granted') })
  expect(screen.getByText('Máy này cho phép GoGo hiển thị thông báo.')).toBeTruthy()
})

it('describes an unreadable permission without claiming anything about it', async () => {
  mockStatus.mockResolvedValue('unknown')
  const screen = await renderScreen(<NotificationSettings />)
  expect(await screen.findByText('Không kiểm tra được quyền thông báo trên máy này.')).toBeTruthy()
  expect(screen.queryByText(/đang tắt trong cài đặt/)).toBeNull()
})

it('shows a recoverable error when Settings cannot be opened, and drops it once permission is granted', async () => {
  let resume: ((state: AppStateStatus) => void) | undefined
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    resume = callback
    return { remove: jest.fn() }
  })
  mockStatus.mockResolvedValue('askable')
  jest.spyOn(Linking, 'openSettings').mockRejectedValueOnce(new Error('unavailable'))
  const screen = await renderScreen(<NotificationSettings />)
  await act(async () => {
    await fireEvent.press(await screen.findByText('Mở cài đặt thông báo'))
  })
  expect(screen.getByText(/Không mở được cài đặt/)).toBeTruthy()

  mockStatus.mockResolvedValue('granted')
  await act(async () => { resume?.('active') })
  expect(screen.queryByText(/Không mở được cài đặt/)).toBeNull()
})

const quietSettings = (enabled = false, timezone: string | null = null): Partial<Settings> => ({
  quietHours: { enabled, timezone }, version: '12', etag: '"quiet-v12"',
  categories: { invite: true, preference_reminder: true, plan_ready: true, plan_changed: true, date_reminder: true },
})

it('reads quiet hours and enables with device timezone without changing master/categories', async () => {
  mockSettings = loaded({ ...quietSettings(), pushEnabled: false })
  const screen = await renderScreen(<NotificationSettings />)
  const control = screen.getByTestId('notification-quiet-hours')
  expect(control.props.value).toBe(false)
  expect(control.props.disabled).toBe(false)
  await fireEvent(control, 'valueChange', true)
  expect(mockMutate).toHaveBeenCalledWith({ quietHours: { enabled: true, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } })
})

it('retains the account timezone when enabling, and sends only enabled when disabling', async () => {
  mockSettings = loaded(quietSettings(false, 'Asia/Ho_Chi_Minh'))
  const screen = await renderScreen(<NotificationSettings />)
  await fireEvent(screen.getByTestId('notification-quiet-hours'), 'valueChange', true)
  expect(mockMutate).toHaveBeenLastCalledWith({ quietHours: { enabled: true, timezone: 'Asia/Ho_Chi_Minh' } })
  mockSettings = loaded(quietSettings(true, 'Asia/Ho_Chi_Minh'))
  const enabled = await renderScreen(<NotificationSettings />)
  expect(enabled.getByTestId('notification-quiet-hours').props.value).toBe(true)
  await fireEvent(enabled.getByTestId('notification-quiet-hours'), 'valueChange', false)
  expect(mockMutate).toHaveBeenLastCalledWith({ quietHours: { enabled: false } })
})

it.each(['saving', 'fetching', 'offline', 'missing-validator', 'missing-field'] as const)('locks quiet hours while %s', async state => {
  mockSettings = loaded(quietSettings())
  if (state === 'saving') mockSave.isPending = true
  if (state === 'fetching') mockSettings.isFetching = true
  if (state === 'offline') mockSettings.isPaused = true
  if (state === 'missing-validator') mockSettings.data!.etag = undefined
  if (state === 'missing-field') mockSettings.data!.quietHours = undefined
  const screen = await renderScreen(<NotificationSettings />)
  const control = screen.getByTestId('notification-quiet-hours')
  expect(control.props.disabled).toBe(true)
  await fireEvent(control, 'valueChange', true)
  expect(mockMutate).not.toHaveBeenCalled()
})

it('explains and retries the failed quiet-hours intent after rollback', async () => {
  mockSettings = loaded(quietSettings())
  const variables = { quietHours: { enabled: true, timezone: 'Asia/Ho_Chi_Minh' } }
  mockSave = { mutate: mockMutate, isPending: false, isError: true, variables }
  const screen = await renderScreen(<NotificationSettings />)
  expect(screen.getByTestId('notification-quiet-hours').props.value).toBe(false)
  await fireEvent.press(screen.getAllByText('Thử lưu lại').at(-1)!)
  expect(mockMutate).toHaveBeenCalledWith(variables)
})

it('keeps quiet hours off when the device timezone cannot be resolved', async () => {
  mockSettings = loaded(quietSettings())
  jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => { throw new Error('unavailable') })
  const screen = await renderScreen(<NotificationSettings />)
  expect(screen.getByTestId('notification-quiet-hours').props.disabled).toBe(true)
  expect(screen.getByText(/Không xác định được múi giờ/)).toBeTruthy()
  await fireEvent(screen.getByTestId('notification-quiet-hours'), 'valueChange', true)
  expect(mockMutate).not.toHaveBeenCalled()
})
