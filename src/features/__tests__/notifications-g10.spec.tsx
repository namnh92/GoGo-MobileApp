import { act, fireEvent } from '@testing-library/react-native'
import { Linking, StyleSheet } from 'react-native'
import { themes, type AppTheme } from '@/shared/ui/theme'
import { spacing } from '@/shared/ui/tokens'
import { renderScreen } from './harness'
import i18n from '@/shared/i18n'
import { viMessages } from '@/shared/i18n/vi'

const mockPush = jest.fn()
const mockRead = jest.fn()
const mockReadAll = jest.fn()
let mockSummary: Record<string, unknown>
let mockReadAllPending = false
const mockSave = jest.fn()
const mockRefetch = jest.fn()
const mockPermission = jest.fn()
let mockSession = 'user'
let mockInbox: Record<string, unknown>
let mockSettings: Record<string, unknown>
let mockSavePending = false
let mockSaveError = false
const mockResolve = jest.fn()

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void) => { jest.requireActual('react').useEffect(effect, [effect]) },
  useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('@/features/settings/location-permission.view', () => ({ LocationPermissionSection: () => null }))
jest.mock('@/features/settings/tracking-consent.view', () => ({ TrackingConsentSection: () => null }))
jest.mock('@/features/settings/device-promotions.view', () => ({ DevicePromotionsSection: () => null }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: mockSession }) }))
jest.mock('@/shared/notifications/permission-bootstrap', () => ({ pushPermission: { status: () => mockPermission() } }))
jest.mock('@/features/notifications/inbox-target', () => ({ resolveInboxTarget: (...args: unknown[]) => mockResolve(...args) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => ({ data: undefined }),
  useNotifications: () => mockInbox,
  useNotificationSummary: () => mockSummary,
  useReadAllNotifications: () => ({ mutateAsync: mockReadAll, isPending: mockReadAllPending }),
  useMarkNotificationRead: () => ({ mutateAsync: mockRead }),
  useNotificationSettings: () => mockSettings,
  useSetNotificationSettings: () => ({ mutate: mockSave, isPending: mockSavePending, isError: mockSaveError, variables: { pushEnabled: false } }),
}))

// Evaluate real screen styles in both modes; Jest has no native theme switching.
let currentTheme: AppTheme = themes.orange
const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
const runtime = unistyles.useUnistyles().rt
jest.spyOn(unistyles.StyleSheet, 'create').mockImplementation(factory => new Proxy({} as ReturnType<typeof unistyles.StyleSheet.create>, {
  get: (_target, key) => key === 'useVariants' ? () => {} : Reflect.get(
    typeof factory === 'function' ? factory(currentTheme, runtime) : factory, key),
}))
const chipModule = jest.requireActual<typeof import('@/shared/ui/chip.view')>('@/shared/ui/chip.view')
const chipSpy = jest.spyOn(chipModule, 'Chip')
const NotificationsScreen = jest.requireActual<typeof import('@/features/notifications/notifications.view')>('@/features/notifications/notifications.view').default
const SettingsScreen = jest.requireActual<typeof import('@/features/notifications/notification-settings.view')>('@/features/notifications/notification-settings.view').default

const PermissionsScreen = jest.requireActual<typeof import('@/features/settings/permissions.view')>('@/features/settings/permissions.view').default

const item = { id: 'notification-1', kind: 'invite', createdAt: '2026-11-08T10:00:00Z', payload: { roomName: 'Phòng thật', inviterName: 'Lan' } }
const settingsData = { pushEnabled: true, source: 'explicit', updatedAt: null }
const loadedInbox = (notifications: unknown[] = [item]) => ({ data: { pages: [{ notifications }] }, isPending: false, isError: false, refetch: mockRefetch })

beforeEach(() => {
  currentTheme = themes.orange
  jest.clearAllMocks()
  mockRead.mockResolvedValue(undefined)
  mockReadAll.mockResolvedValue({ status: 'completed' })
  mockReadAllPending = false
  mockSummary = { data: { unreadCount: 32, asOf: '2026-11-08T12:00:00Z', readThroughCursor: 'opaque-summary-cutoff' }, refetch: mockRefetch }
  mockResolve.mockResolvedValue({ to: 'open', path: '/rooms/room-1' })
  mockPermission.mockResolvedValue('granted')
  mockInbox = loadedInbox()
  mockSettings = { data: settingsData, isPending: false, isError: false, refetch: mockRefetch }
  mockSession = 'user'
  mockSavePending = false
  mockSaveError = false
})

it.each(['orange', 'orangeDark'] as const)('keeps inbox filters at shared Chip size and aligned in %s', async mode => {
  currentTheme = themes[mode]
  const screen = await renderScreen(<NotificationsScreen />)
  const chips = chipSpy.mock.calls.map(([props]) => props)
  expect(chips).toHaveLength(4)
  for (const chip of chips) {
    expect(chip.style).toBeUndefined()
    expect(chip.appearance).toBeUndefined()
    const label = screen.getByText(chip.label)
    const labelStyle = StyleSheet.flatten(label.props.style)
    let body = label.parent
    while (body && StyleSheet.flatten(body.props.style)?.minHeight !== 32) body = body.parent
    expect(body).not.toBeNull()
    const bodyStyle = StyleSheet.flatten(body!.props.style)
    expect(bodyStyle.height).toBeUndefined()
    expect(bodyStyle.paddingHorizontal).toBe(spacing[3])
    expect(bodyStyle.paddingVertical).toBe(6)
    // Standard text + padding + border resolve to the same 32pt visual body.
    expect(labelStyle.lineHeight + 2 * (bodyStyle.paddingVertical + bodyStyle.borderWidth)).toBe(32)
    expect(bodyStyle.backgroundColor).toBe(chip.variant === 'selected'
      ? currentTheme.accent.primary : currentTheme.surface.subtle)
  }
  let row = screen.getByText(chips[0]!.label).parent
  while (row && !row.props.horizontal) row = row.parent
  expect(row).not.toBeNull()
  const rowStyle = StyleSheet.flatten(row!.props.contentContainerStyle)
  // Without centering, Yoga stretches the bare selected chip to the siblings'
  // 44pt touch hosts, while their visual chip bodies remain 32pt.
  expect(rowStyle.alignItems).toBe('center')
  expect(rowStyle.gap).toBe(spacing[2])
  expect(rowStyle.paddingVertical).toBe(spacing[1])
  expect(rowStyle.paddingHorizontal ?? 0).toBe(0)
  expect(rowStyle.marginHorizontal ?? 0).toBe(0)
})

it('inbox default uses real payload, neutral host semantics and gated controls', async () => {
  const screen = await renderScreen(<NotificationsScreen />)
  expect(screen.getByText('Phòng "Phòng thật"')).toBeTruthy()
  expect(screen.getByText('Người tạo lời mời: Lan')).toBeTruthy()
  expect(screen.getByText(viMessages['notifications.body.invite'])).toBeTruthy()
  const readAll = screen.getByRole('button', { name: 'Đọc tất cả' })
  expect(readAll.props.accessibilityState.disabled).toBe(false)
  await fireEvent.press(readAll)
  expect(mockReadAll).toHaveBeenCalledWith('opaque-summary-cutoff')
  expect(mockRead).not.toHaveBeenCalled()
  expect(screen.getByText('32 mới')).toBeTruthy()
  expect(screen.queryByText(/7 ngày/)).toBeNull()
})

it('Later only marks this item as read, deduplicates a double tap and never navigates', async () => {
  let finish!: () => void
  mockRead.mockReturnValue(new Promise<void>(resolve => { finish = resolve }))
  const screen = await renderScreen(<NotificationsScreen />)
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Để sau' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Để sau' }))
  })
  expect(mockRead).toHaveBeenCalledTimes(1)
  expect(mockRead).toHaveBeenCalledWith(item.id)
  expect(mockResolve).not.toHaveBeenCalled()
  expect(mockPush).not.toHaveBeenCalled()
  await act(async () => finish())
})

it('opening marks unread once and preserves the existing resolver', async () => {
  const screen = await renderScreen(<NotificationsScreen />)
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Xem phòng' })))
  expect(mockRead).toHaveBeenCalledWith(item.id)
  expect(mockResolve).toHaveBeenCalledWith(item)
  expect(mockPush).toHaveBeenCalledWith('/rooms/room-1')
})

it('a read row does not send another mark-read and Later is disabled', async () => {
  mockInbox = loadedInbox([{ ...item, readAt: '2026-11-08T11:00:00Z' }])
  const screen = await renderScreen(<NotificationsScreen />)
  expect(screen.getByRole('button', { name: 'Để sau' }).props.accessibilityState.disabled).toBe(true)
  expect(screen.queryByTestId(`notification-unread-${item.id}`)).toBeNull()
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Xem phòng' })))
  expect(mockRead).not.toHaveBeenCalled()
})

it('read failure shows the shared result sheet without fabricating success', async () => {
  mockRead.mockRejectedValue(new Error('network'))
  const screen = await renderScreen(<NotificationsScreen />)
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Để sau' })))
  expect(screen.getByText(viMessages['g10.readFailed'])).toBeTruthy()
  expect(screen.getByTestId(`notification-unread-${item.id}`)).toBeTruthy()
})

it.each(['loading', 'empty', 'error'] as const)('inbox state: %s', async state => {
  mockInbox = state === 'loading' ? { isPending: true } : state === 'error'
    ? { isError: true, error: new Error('network'), refetch: mockRefetch } : loadedInbox([])
  const screen = await renderScreen(<NotificationsScreen />)
  if (state === 'loading') expect(screen.getByTestId('notifications-loading')).toBeTruthy()
  else if (state === 'empty') {
    expect(screen.getByText(viMessages['g10.emptyTitle'])).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại thông báo' }))
    expect(mockRefetch).toHaveBeenCalled()
  } else {
    expect(screen.getByText(viMessages['common.errorTitle'])).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }))
    expect(mockRefetch).toHaveBeenCalled()
  }
})

it('renders N-member progress, stop counts and change facts without inventing previews', async () => {
  mockInbox = loadedInbox([
    { id: 'a', kind: 'preference_reminder', payload: { preferenceProgress: { completedCount: 6, memberCount: 9 } } },
    { id: 'b', kind: 'plan_ready', payload: { stopCount: 3 } },
    { id: 'c', kind: 'plan_changed', payload: { planChange: { action: 'edit', addedStopCount: 2 } } },
  ])
  const screen = await renderScreen(<NotificationsScreen />)
  expect(screen.getByText('6/9 thành viên đã chọn xong')).toBeTruthy()
  expect(screen.getByText('3 điểm dừng')).toBeTruthy()
  expect(screen.getByText('Thêm 2 điểm dừng')).toBeTruthy()
  expect(screen.queryByText(/19:00|15:30|The Workshop/)).toBeNull()
})

it.each(['orange', 'orangeDark'] as const)('settings in %s has one real master and six gated switches', async mode => {
  currentTheme = themes[mode]
  const screen = await renderScreen(<SettingsScreen />)
  const switches = screen.getAllByRole('switch')
  expect(switches).toHaveLength(7)
  expect(screen.getByTestId('notification-master').props.disabled).toBe(false)
  let card = screen.getByTestId('notification-master').parent
  while (card && !StyleSheet.flatten(card.props.style)?.backgroundColor) card = card.parent
  expect(StyleSheet.flatten(card!.props.style).backgroundColor).toBe(currentTheme.redesign.card)
  for (const control of switches.filter(control => control.props.testID !== 'notification-master')) {
    expect(control.props.disabled).toBe(true)
    expect(control.props.value).toBe(false)
    await fireEvent(control, 'valueChange', true)
  }
  expect(screen.getByText(viMessages['g10.categoriesUnavailable'])).toBeTruthy()
  expect(screen.getByText(viMessages['g10.quietUnavailable'])).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Bật tất cả' }).props.accessibilityState.disabled).toBe(true)
  expect(mockSave).not.toHaveBeenCalled()
  expect(screen.queryByText('5/5 loại đang bật')).toBeNull()
})

it('master reuses the existing account mutation without extra fields or category writes', async () => {
  const screen = await renderScreen(<SettingsScreen />)
  await fireEvent(screen.getByTestId('notification-master'), 'valueChange', false)
  expect(mockSave).toHaveBeenCalledTimes(1)
  expect(mockSave).toHaveBeenCalledWith({ pushEnabled: false })
})

it('master retains rollback feedback and retries the same choice; in-flight saves lock the switch', async () => {
  mockSaveError = true
  const screen = await renderScreen(<SettingsScreen />)
  expect(screen.getByTestId('notification-master').props.value).toBe(true)
  expect(screen.getByText(viMessages['notificationSettings.saveFailed'])).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: viMessages['notificationSettings.retrySave'] }))
  expect(mockSave).toHaveBeenCalledWith({ pushEnabled: false })
  mockSavePending = true
  const pending = await renderScreen(<SettingsScreen />)
  expect(pending.getByTestId('notification-master').props.disabled).toBe(true)
})

it.each(['loading', 'empty', 'error'] as const)('settings state: %s never enables a made-up master', async state => {
  mockSettings = { data: undefined, isPending: state === 'loading', isError: state === 'error', error: new Error('network'), refetch: mockRefetch }
  const screen = await renderScreen(<SettingsScreen />)
  expect(screen.getByTestId('notification-master').props.disabled).toBe(true)
  expect(screen.getByTestId('notification-master').props.value).toBe(false)
  if (state === 'loading') expect(screen.getByTestId('notification-settings-loading')).toBeTruthy()
  else if (state === 'empty') expect(screen.getByText(viMessages['notificationSettings.loadFailed'])).toBeTruthy()
  else expect(screen.getByText(viMessages['common.errorTitle'])).toBeTruthy()
})

it('keeps device settings available when OS permission is granted', async () => {
  const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined)
  const screen = await renderScreen(<SettingsScreen />)
  await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Cài đặt máy' })))
  expect(open).toHaveBeenCalledTimes(1)
  open.mockRestore()
})

it('guest state cannot expose cached account settings or inbox content', async () => {
  mockSession = 'guest'
  const settings = await renderScreen(<SettingsScreen />)
  expect(settings.queryAllByRole('switch')).toHaveLength(0)
  const inbox = await renderScreen(<NotificationsScreen />)
  expect(inbox.queryByText('Phòng "Phòng thật"')).toBeNull()
})

it('renders English sentence case and the same unavailable quiet-hours policy', async () => {
  await act(async () => { await i18n.changeLanguage('en') })
  try {
    const screen = await renderScreen(<SettingsScreen />)
    expect(screen.getByText('Notification settings')).toBeTruthy()
    expect(screen.getByText('Members joining rooms')).toBeTruthy()
    expect(screen.getByTestId('notification-quiet-hours').props.disabled).toBe(true)
  } finally { await act(async () => { await i18n.changeLanguage('vi') }) }
})

it('a server already returning category settings cannot be overwritten by legacy PUT', async () => {
  mockSettings = { ...mockSettings, data: { ...settingsData, categories: { invite: false } } }
  const screen = await renderScreen(<SettingsScreen />)
  expect(screen.getByTestId('notification-master').props.disabled).toBe(true)
  await fireEvent(screen.getByTestId('notification-master'), 'valueChange', true)
  expect(mockSave).not.toHaveBeenCalled()
})

it('offline initial reads stop loading and cached refetch errors keep content visible', async () => {
  mockInbox = { isPending: true, isPaused: true }
  const offline = await renderScreen(<NotificationsScreen />)
  expect(offline.getByText(viMessages['common.offlineTitle'])).toBeTruthy()
  mockInbox = { ...loadedInbox(), isError: true, error: new Error('network') }
  const cached = await renderScreen(<NotificationsScreen />)
  expect(cached.getByText('Phòng "Phòng thật"')).toBeTruthy()
  mockSettings = { isPending: true, isPaused: true }
  const settings = await renderScreen(<SettingsScreen />)
  expect(settings.getByText(viMessages['common.offlineTitle'])).toBeTruthy()
  expect(settings.getByTestId('notification-master').props.disabled).toBe(true)
})

it('a denied OS permission keeps the account master separate and exposes device settings', async () => {
  mockPermission.mockResolvedValue('askable')
  const screen = await renderScreen(<SettingsScreen />)
  expect(screen.getByText(viMessages['notificationSettings.pushNote'])).toBeTruthy()
  expect(screen.getByTestId('notification-master').props.disabled).toBe(false)
  expect(screen.getByRole('button', { name: viMessages['notificationSettings.openSettings'] })).toBeTruthy()
})

it.each(['orange', 'orangeDark'] as const)('summary drives the exact inbox badge and read-all in %s', async mode => {
  currentTheme = themes[mode]
  mockInbox = loadedInbox([])
  const screen = await renderScreen(<NotificationsScreen />)
  expect(screen.getByText('32 mới')).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Đọc tất cả' }))
  expect(mockReadAll).toHaveBeenCalledWith('opaque-summary-cutoff')
})

it('locks read-all during polling, and never substitutes a missing/error summary', async () => {
  mockReadAllPending = true
  const busy = await renderScreen(<NotificationsScreen />)
  expect(busy.getByRole('button', { name: 'Đọc tất cả' }).props.accessibilityState.disabled).toBe(true)
  mockReadAllPending = false
  mockSummary = { isError: true, error: new Error('network'), refetch: mockRefetch }
  const failed = await renderScreen(<NotificationsScreen />)
  expect(failed.getByRole('button', { name: 'Đọc tất cả' }).props.accessibilityState.disabled).toBe(true)
  expect(failed.queryByText(/\d+ mới/)).toBeNull()
})

it('deduplicates read-all taps and shows recoverable failure without clearing unread rows', async () => {
  let fail!: (error: Error) => void
  mockReadAll.mockReturnValue(new Promise((_resolve, reject) => { fail = reject }))
  const screen = await renderScreen(<NotificationsScreen />)
  await act(async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Đọc tất cả' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Đọc tất cả' }))
  })
  expect(mockReadAll).toHaveBeenCalledTimes(1)
  await act(async () => fail(new Error('network')))
  expect(screen.getByText(viMessages['g10.readAllFailedBody'])).toBeTruthy()
  expect(screen.getByTestId(`notification-unread-${item.id}`)).toBeTruthy()
  await fireEvent.press(screen.getByRole('button', { name: 'Tải lại thông báo' }))
  expect(mockRefetch).toHaveBeenCalledTimes(2)
})


it.each(['orange', 'orangeDark'] as const)('has exactly one header gear settings entry in %s', async mode => {
  currentTheme = themes[mode]
  const screen = await renderScreen(<NotificationsScreen />)
  const entries = screen.getAllByRole('button', { name: viMessages['g10.settingsTitle'] })
  expect(entries).toHaveLength(1)
  expect(screen.queryByText(viMessages['g10.settingsTitle'])).toBeNull()
  let parent = entries[0].parent
  while (parent && parent.props.testID !== 'app-header') parent = parent.parent
  expect(parent).not.toBeNull()
  await fireEvent.press(entries[0])
  expect(mockPush).toHaveBeenCalledTimes(1)
  expect(mockPush).toHaveBeenCalledWith('/settings/notifications')
})


it.each(['loading', 'empty', 'error', 'offline', 'guest'] as const)('keeps one settings gear reachable in the %s inbox', async state => {
  mockInbox = state === 'loading' ? { isPending: true } : state === 'error' ? { isError: true }
    : state === 'offline' ? { isPending: true, isPaused: true } : loadedInbox([])
  if (state === 'guest') mockSession = 'guest'
  const screen = await renderScreen(<NotificationsScreen />)
  const gears = screen.getAllByRole('button', { name: viMessages['g10.settingsTitle'] })
  expect(gears).toHaveLength(1)
  await fireEvent.press(gears[0])
  expect(mockPush).toHaveBeenCalledWith('/settings/notifications')
})

it('labels the header gear in English sentence case', async () => {
  await act(async () => { await i18n.changeLanguage('en') })
  try {
    const screen = await renderScreen(<NotificationsScreen />)
    expect(screen.queryByText('Notification settings')).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Notification settings' }))
    expect(mockPush).toHaveBeenCalledWith('/settings/notifications')
  } finally { await act(async () => { await i18n.changeLanguage('vi') }) }
})


it.each([
  ['orange', 'vi', 'Thông báo', 'Đang bật'],
  ['orangeDark', 'vi', 'Thông báo', 'Đang bật'],
  ['orange', 'en', 'Notifications', 'On'],
  ['orangeDark', 'en', 'Notifications', 'On'],
] as const)('permissions row renders and navigates in %s/%s', async (mode, locale, title, state) => {
  currentTheme = themes[mode]
  await act(async () => { await i18n.changeLanguage(locale) })
  try {
    const screen = await renderScreen(<PermissionsScreen />)
    const rows = screen.getAllByRole('button', { name: title })
    expect(rows).toHaveLength(1)
    expect(rows[0].props.accessibilityValue.text).toBe(state)
    expect(screen.queryAllByRole('switch')).toHaveLength(0)
    expect(StyleSheet.flatten(rows[0].props.style).minHeight).toBeGreaterThanOrEqual(44)
    let card = rows[0].parent
    while (card && !StyleSheet.flatten(card.props.style)?.backgroundColor) card = card.parent
    expect(StyleSheet.flatten(card!.props.style).backgroundColor).toBe(currentTheme.redesign.card)
    await fireEvent.press(rows[0])
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith('/settings/notifications')
  } finally { await act(async () => { await i18n.changeLanguage('vi') }) }
})
