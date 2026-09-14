import { act, fireEvent } from '@testing-library/react-native'
import { AppState, Linking, type AppStateStatus } from 'react-native'
import { renderScreen } from './harness'

/**
 * NTF-APP-010 (#215) — one switch for the account, device permission shown
 * beside it and never merged into it; rendered inside APP-058's combined screen.
 */

const mockStatus = jest.fn()
const mockMutate = jest.fn()
type Settings = { pushEnabled: boolean; source: string; updatedAt: string | null }
let mockSettings: { data: Settings | undefined; isPending: boolean; isError: boolean; refetch: jest.Mock }
let mockSave: { mutate: jest.Mock; isPending: boolean; isError: boolean; variables?: { pushEnabled: boolean } }
jest.mock('@/shared/notifications/permission-bootstrap', () => ({ pushPermission: { status: () => mockStatus() } }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api', () => ({
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
import NotificationSettings from '@/features/settings/permissions.view'

const loaded = (settings: Partial<Settings> = {}) => ({
  data: { pushEnabled: true, source: 'explicit', updatedAt: '2026-09-14T00:00:00Z', ...settings },
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
  const switches = screen.getAllByRole('switch')
  expect(switches).toHaveLength(1)
  expect(switches[0].props.value).toBe(true)
  expect(switches[0].props.disabled).toBe(false)
  expect(screen.getByLabelText('Thông báo')).toBeTruthy()
})

it('saves the choice on toggle and nothing else', async () => {
  const screen = await renderScreen(<NotificationSettings />)
  await act(async () => {
    fireEvent(screen.getByRole('switch'), 'valueChange', false)
  })
  expect(mockMutate).toHaveBeenCalledTimes(1)
  expect(mockMutate).toHaveBeenCalledWith({ pushEnabled: false })
})

it('stays off and locked while the first read runs, and retries a failed read in place', async () => {
  mockSettings = { data: undefined, isPending: true, isError: false, refetch: jest.fn() }
  const screen = await renderScreen(<NotificationSettings />)
  expect(screen.getByRole('switch').props.value).toBe(false)
  expect(screen.getByRole('switch').props.disabled).toBe(true)
  expect(screen.getByText('Đang tải…')).toBeTruthy()

  const refetch = jest.fn()
  mockSettings = { data: undefined, isPending: false, isError: true, refetch }
  const failed = await renderScreen(<NotificationSettings />)
  await act(async () => {
    fireEvent.press(failed.getByText('Thử lại'))
  })
  expect(refetch).toHaveBeenCalledTimes(1)
})

it('locks the switch while a save is in flight, so a double tap sends one request', async () => {
  mockSave = { mutate: mockMutate, isPending: true, isError: false, variables: { pushEnabled: false } }
  const screen = await renderScreen(<NotificationSettings />)
  expect(screen.getByRole('switch').props.disabled).toBe(true)
})

it('says a failed save was rolled back and retries the same choice', async () => {
  // The hook already restored the cached value; the screen explains it.
  mockSettings = loaded({ pushEnabled: true })
  mockSave = { mutate: mockMutate, isPending: false, isError: true, variables: { pushEnabled: false } }
  const screen = await renderScreen(<NotificationSettings />)
  expect(screen.getByRole('switch').props.value).toBe(true)
  expect(screen.getByText(/Công tắc đã trở về trạng thái trước/)).toBeTruthy()
  await act(async () => {
    fireEvent.press(screen.getByText('Thử lưu lại'))
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
  expect(await screen.findByText(/đang tắt trong Cài đặt của máy này/)).toBeTruthy()
  expect(screen.queryByText(/Máy này cho phép GoGo hiển thị thông báo/)).toBeNull()
  expect(screen.getByText('Mở Cài đặt thông báo')).toBeTruthy()
  // The account preference is still the account's to change.
  expect(screen.getByRole('switch').props.disabled).toBe(false)
})

it('re-reads device permission when the app returns from Settings', async () => {
  let resume: ((state: AppStateStatus) => void) | undefined
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    resume = callback
    return { remove: jest.fn() }
  })
  mockStatus.mockResolvedValue('askable')
  const screen = await renderScreen(<NotificationSettings />)
  expect(await screen.findByText(/đang tắt trong Cài đặt của máy này/)).toBeTruthy()

  mockStatus.mockResolvedValue('granted')
  await act(async () => {
    resume?.('active')
  })
  expect(screen.getByText('Máy này cho phép GoGo hiển thị thông báo.')).toBeTruthy()
  expect(screen.queryByText('Mở Cài đặt thông báo')).toBeNull()
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
  expect(screen.queryByText(/đang tắt trong Cài đặt/)).toBeNull()
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
    fireEvent.press(await screen.findByText('Mở Cài đặt thông báo'))
  })
  expect(screen.getByText(/Không mở được Cài đặt/)).toBeTruthy()

  mockStatus.mockResolvedValue('granted')
  await act(async () => { resume?.('active') })
  expect(screen.queryByText(/Không mở được Cài đặt/)).toBeNull()
})
