import { act, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import '@/shared/i18n'
import { themes } from '@/shared/ui/theme'

let mockPending = true
let mockNextPage = false
const mockRefetch = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => undefined,
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => ({}),
  useNotifications: () => ({
    isPending: mockPending, isError: false, isFetchingNextPage: mockNextPage,
    refetch: mockRefetch,
    data: mockPending ? undefined : { pages: [{ notifications: [{ id: 'n1', kind: 'campaign', createdAt: '2026-11-09T00:00:00Z' }] }] },
  }),
  useMarkNotificationRead: () => ({ mutate: jest.fn() }),
}))
import NotificationsScreen from '../notifications/notifications.view'

describe.each(['orange', 'orangeDark'] as const)('%s list loading', name => {
  beforeEach(() => {
    StyleSheet.configure({ themes: { [name]: themes[name] } as unknown as typeof themes })
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    mockPending = true
    mockNextPage = false
    mockRefetch.mockReset()
  })
  afterEach(() => jest.restoreAllMocks())

  it('uses row skeletons for page one and the mark only while loading another page', async () => {
    const view = await render(<NotificationsScreen />)
    expect(screen.getByTestId('notifications-first-load-skeleton')).toBeTruthy()
    expect(screen.queryByTestId('loading-indicator')).toBeNull()
    mockPending = false
    mockNextPage = true
    await view.rerender(<NotificationsScreen />)
    expect(screen.queryByTestId('notifications-first-load-skeleton')).toBeNull()
    expect(screen.getByTestId('loading-indicator')).toBeTruthy()
    mockNextPage = false
    await view.rerender(<NotificationsScreen />)
    expect(screen.queryByTestId('loading-indicator')).toBeNull()
  })

  it('uses the branded refresh overlay while keeping loaded inbox rows', async () => {
    mockPending = false
    let finish!: () => void
    mockRefetch.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
    await render(<NotificationsScreen />)
    const control = () => screen.getByTestId('notifications-list').props.refreshControl
    await act(async () => { control().props.onRefresh() })
    expect(mockRefetch).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('refresh-loading-indicator')).toBeTruthy()
    expect(screen.getByTestId('notifications-list').props.data).toHaveLength(1)
    expect(screen.queryByTestId('notifications-first-load-skeleton')).toBeNull()
    await act(async () => { finish() })
    expect(screen.queryByTestId('refresh-loading-indicator')).toBeNull()
  })
})
