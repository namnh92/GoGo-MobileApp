import { act, render, screen, within } from '@testing-library/react-native'
import { AccessibilityInfo, StyleSheet as NativeStyles } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import '@/shared/i18n'
import { themes } from '@/shared/ui/theme'
import { scriptedTime } from './scripted-time'

scriptedTime()

let mockPending = true
let mockNextPage = false
let mockRefetching = false
let mockSystemPending = false
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
  useSystemNotificationsQuery: () => ({ status: mockSystemPending ? 'supported' : 'unsupported', isPending: mockSystemPending, refetch: jest.fn() }),
  useNotificationSummary: () => ({ data: undefined, refetch: jest.fn() }),
  useReadAllNotifications: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useNotifications: () => ({
    isPending: mockPending, isRefetching: mockRefetching, isError: false, isFetchingNextPage: mockNextPage,
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
    mockSystemPending = false
    mockNextPage = false
    mockRefetching = false
    mockRefetch.mockReset()
  })
  afterEach(() => jest.restoreAllMocks())

  it('uses row skeletons for page one and the mark only while loading another page', async () => {
    mockRefetching = true
    const view = await render(<NotificationsScreen />)
    expect(screen.getByTestId('notifications-loading')).toBeTruthy()
    expect(screen.getByTestId('notifications-feed').props.refreshControl.props.refreshing).toBe(false)
    expect(screen.queryByTestId('refresh-loading-indicator')).toBeNull()
    expect(screen.queryByTestId('notifications-loading-more')).toBeNull()
    mockPending = false
    mockNextPage = true
    await view.rerender(<NotificationsScreen />)
    expect(screen.queryByTestId('notifications-loading')).toBeNull()
    expect(NativeStyles.flatten(screen.getByTestId('notifications-loading-more').props.style)).toMatchObject({ width: 48, height: 48 })
    mockNextPage = false
    await view.rerender(<NotificationsScreen />)
    expect(screen.queryByTestId('notifications-loading-more')).toBeNull()
  })

  it('uses skeletons for the system feed first load as well', async () => {
    mockSystemPending = true
    await render(<NotificationsScreen />)
    expect(within(screen.getByTestId('system-notifications-loading')).getAllByTestId('skeleton-block', { includeHiddenElements: true }).length).toBeGreaterThan(0)
    expect(screen.queryByTestId('loading-indicator')).toBeNull()
    expect(screen.queryByTestId('system-notifications-loading-more')).toBeNull()
  })

  it('uses the branded refresh overlay while keeping loaded inbox rows', async () => {
    mockPending = false
    let finish!: () => void
    mockRefetch.mockImplementation(() => new Promise<void>(resolve => { finish = resolve }))
    await render(<NotificationsScreen />)
    const control = () => screen.getByTestId('notifications-feed').props.refreshControl
    await act(async () => { control().props.onRefresh() })
    expect(mockRefetch).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('refresh-loading-indicator')).toBeTruthy()
    expect(screen.getByTestId('notifications-feed').props.data).toHaveLength(1)
    expect(screen.queryByTestId('notifications-loading')).toBeNull()
    await act(async () => { finish() })
    expect(screen.queryByTestId('refresh-loading-indicator')).toBeNull()
  })
})
