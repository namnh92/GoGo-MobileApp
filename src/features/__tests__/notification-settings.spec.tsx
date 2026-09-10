import { act, fireEvent } from '@testing-library/react-native'
import { AppState, Linking, type AppStateStatus } from 'react-native'
import { renderScreen } from './harness'

const mockStatus = jest.fn()
const mockMutate = jest.fn()
let mockPreferences = { data: [] as { channel?: 'push' | 'email'; kind?: string; enabled?: boolean }[] | undefined, isPending: false, isError: false, refetch: jest.fn() }
jest.mock('@/shared/notifications/permission-bootstrap', () => ({ pushPermission: { status: () => mockStatus() } }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api', () => ({
  useNotificationPreferences: () => mockPreferences,
  useSetNotificationPreference: () => ({ mutate: mockMutate, isPending: false, isError: false }),
}))
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useFocusEffect: (effect: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').useEffect(effect, [effect])
  },
}))
import NotificationSettings from '@/features/notifications/notification-settings.view'

beforeEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
  mockPreferences = { data: [], isPending: false, isError: false, refetch: jest.fn() }
})

it('keeps the settings layout visible when loading fails and retries in place', async () => {
  const refetch = jest.fn()
  mockPreferences = { data: undefined, isPending: false, isError: true, refetch }
  mockStatus.mockResolvedValue('granted')
  const screen = await renderScreen(<NotificationSettings />)
  expect(screen.getAllByRole('switch')).toHaveLength(12)
  await fireEvent.press(screen.getByText('Thử lại'))
  expect(refetch).toHaveBeenCalledTimes(1)
})

it('renders every row immediately and disables switches while the first fetch runs', async () => {
  mockPreferences = { data: undefined, isPending: true, isError: false, refetch: jest.fn() }
  mockStatus.mockResolvedValue('granted')
  const screen = await renderScreen(<NotificationSettings />)
  expect(screen.getAllByRole('switch')).toHaveLength(12)
  for (const toggle of screen.getAllByRole('switch')) {
    expect(toggle.props.value).toBe(false)
    expect(toggle.props.disabled).toBe(true)
  }
  expect(screen.getByText('Đang tải…')).toBeTruthy()
})

it('keeps all push switches off and disabled before OS consent, while email stays independent', async () => {
  mockStatus.mockResolvedValue('askable')
  const screen = await renderScreen(<NotificationSettings />)
  const switches = screen.getAllByRole('switch')
  for (const toggle of switches.slice(0, 6)) {
    expect(toggle.props.value).toBe(false)
    expect(toggle.props.disabled).toBe(true)
  }
  expect(switches[6].props.value).toBe(true)
  expect(switches[6].props.disabled).toBe(false)
  await fireEvent(switches[0], 'valueChange', true)
  expect(mockMutate).not.toHaveBeenCalled()
})

it('refreshes permission after returning from Settings, including revocation', async () => {
  let resume: ((state: AppStateStatus) => void) | undefined
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    resume = callback
    return { remove: jest.fn() }
  })
  mockStatus.mockResolvedValue('granted')
  const screen = await renderScreen(<NotificationSettings />)
  expect(screen.getAllByRole('switch')[0].props.value).toBe(true)
  mockStatus.mockResolvedValue('askable')
  await act(async () => { resume?.('active') })
  expect(screen.getAllByRole('switch')[0].props.value).toBe(false)
  expect(screen.getAllByRole('switch')[0].props.disabled).toBe(true)
})

it('keeps the previous permission state visible while a foreground refresh is pending', async () => {
  let resume: ((state: AppStateStatus) => void) | undefined
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    resume = callback
    return { remove: jest.fn() }
  })
  mockStatus.mockResolvedValueOnce('granted')
  const screen = await renderScreen(<NotificationSettings />)
  expect(screen.getAllByRole('switch')[0].props.value).toBe(true)

  let resolveStatus!: (state: 'askable') => void
  mockStatus.mockReturnValueOnce(new Promise(resolve => { resolveStatus = resolve }))
  await act(async () => { resume?.('active') })
  expect(screen.getAllByRole('switch')[0].props.value).toBe(true)

  await act(async () => { resolveStatus('askable') })
  expect(screen.getAllByRole('switch')[0].props.value).toBe(false)
})

it('describes an unavailable permission read without claiming notifications are off', async () => {
  mockStatus.mockResolvedValue('unknown')
  const screen = await renderScreen(<NotificationSettings />)
  expect(screen.getByText(/Không kiểm tra được quyền thông báo/)).toBeTruthy()
  expect(screen.queryByText(/Thông báo trên máy này đang tắt/)).toBeNull()
})

it('shows a recoverable error when system Settings cannot be opened', async () => {
  mockStatus.mockResolvedValue('askable')
  jest.spyOn(Linking, 'openSettings').mockRejectedValueOnce(new Error('unavailable'))
  const screen = await renderScreen(<NotificationSettings />)
  await fireEvent.press(screen.getByText('Mở Cài đặt thông báo'))
  expect(screen.getByText(/Không mở được Cài đặt/)).toBeTruthy()
})
