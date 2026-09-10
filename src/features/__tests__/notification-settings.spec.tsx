import { act, fireEvent } from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'
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
  jest.clearAllMocks()
  mockPreferences = { data: [], isPending: false, isError: false, refetch: jest.fn() }
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
