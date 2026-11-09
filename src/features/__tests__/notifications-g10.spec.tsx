import { act, fireEvent, within } from '@testing-library/react-native'
import { AppState, Linking, StyleSheet, type AppStateStatus } from 'react-native'
import { themes, type AppTheme } from '@/shared/ui/theme'
import { buttonSizes, spacing, fontFamily } from '@/shared/ui/tokens'
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
let mockSystemInbox: Record<string, unknown>
let mockInbox: Record<string, unknown>
let mockSettings: Record<string, unknown>
let mockSavePending = false
let mockSaveError = false
const mockResolve = jest.fn()
const mockInboxQuery = jest.fn()
const mockSummaryQuery = jest.fn()
const mockMembersRead = jest.fn()
const mockPlaceRead = jest.fn()

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
  useSystemNotificationsQuery: () => mockSystemInbox,
  useRoom: () => ({ data: undefined }),
  useRoomMembers: (id: unknown) => mockMembersRead(id),
  usePlaceDetail: (id: unknown) => mockPlaceRead(id),
  useNotifications: (options: unknown) => { mockInboxQuery(options); return mockInbox },
  useNotificationSummary: (options: unknown) => { mockSummaryQuery(options); return mockSummary },
  useReadAllNotifications: () => ({ mutateAsync: mockReadAll, isPending: mockReadAllPending }),
  useMarkNotificationRead: () => ({ mutateAsync: mockRead }),
  useNotificationSettings: () => mockSettings,
  useSetNotificationSettings: () => ({ mutate: mockSave, isPending: mockSavePending, isError: mockSaveError, variables: { pushEnabled: false } }),
}))

// Evaluate real screen styles in both modes; Jest has no native theme switching.
let currentTheme: AppTheme = themes.orange
const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
const runtime = unistyles.useUnistyles().rt
jest.spyOn(unistyles, 'useUnistyles').mockImplementation(() => ({ theme: currentTheme, rt: runtime }))
jest.spyOn(unistyles.StyleSheet, 'create').mockImplementation(factory => new Proxy({} as ReturnType<typeof unistyles.StyleSheet.create>, {
  get: (_target, key) => key === 'useVariants' ? () => {} : Reflect.get(
    typeof factory === 'function' ? factory(currentTheme, runtime) : factory, key),
}))
const chipModule = jest.requireActual<typeof import('@/shared/ui/chip.view')>('@/shared/ui/chip.view')
const chipSpy = jest.spyOn(chipModule, 'Chip')
const notificationRowModule = jest.requireActual<typeof import('@/features/notifications/notification-row.view')>('@/features/notifications/notification-row.view')
const notificationRowSpy = jest.spyOn(notificationRowModule, 'NotificationRow')
const NotificationsScreen = jest.requireActual<typeof import('@/features/notifications/notifications.view')>('@/features/notifications/notifications.view').default
const SettingsScreen = jest.requireActual<typeof import('@/features/notifications/notification-settings.view')>('@/features/notifications/notification-settings.view').default

const PermissionsScreen = jest.requireActual<typeof import('@/features/settings/permissions.view')>('@/features/settings/permissions.view').default

const item = { id: 'notification-1', kind: 'invite', createdAt: '2026-11-08T10:00:00Z', payload: { roomName: 'Phòng thật', inviterName: 'Lan', roomId: '11111111-1111-4111-8111-111111111111' } }
const settingsData = { pushEnabled: true, source: 'explicit', updatedAt: null }
const loadedInbox = (notifications: unknown[] = [item]) => ({ data: { pages: [{ notifications, clientFilter: false }] }, isPending: false, isError: false, refetch: mockRefetch })

beforeEach(() => {
  currentTheme = themes.orange
  jest.clearAllMocks()
  mockRead.mockResolvedValue(undefined)
  mockReadAll.mockResolvedValue({ status: 'completed' })
  mockReadAllPending = false
  mockSummary = { data: { unreadCount: 32, asOf: '2026-11-08T12:00:00Z', readThroughCursor: 'opaque-summary-cutoff' }, refetch: mockRefetch }
  mockResolve.mockResolvedValue({ to: 'open', path: '/rooms/room-1' })
  mockPermission.mockResolvedValue('granted')
  mockSystemInbox = { status: 'unsupported' }
  mockInbox = loadedInbox()
  mockSettings = { data: settingsData, isPending: false, isError: false, refetch: mockRefetch }
  mockSession = 'user'
  mockSavePending = false
  mockSaveError = false
  mockMembersRead.mockReturnValue({ data: [] })
  mockPlaceRead.mockReturnValue({ data: undefined })
})

it.each(['orange', 'orangeDark'] as const)('keeps inbox filters at shared Chip size and aligned in %s', async mode => {
  currentTheme = themes[mode]
  const screen = await renderScreen(<NotificationsScreen />)
  const chips = chipSpy.mock.calls.map(([props]) => props)
  expect(chips).toHaveLength(6)
  expect(chips.map(chip => chip.label)).toEqual([
    viMessages['g10.filter.all'], viMessages['g10.filter.invite'], viMessages['g10.filter.plan'], viMessages['g10.filter.date'], viMessages['g10.filter.system'], viMessages['g10.filter.publicSystem'],
  ])
  expect(screen.queryByText(/Lọc theo loại chưa khả dụng/)).toBeNull()
  expect(screen.getByRole('button', { name: 'Đọc tất cả' })).toBeEnabled()
  for (const chip of chips) {
    expect(chip.style).toBeUndefined()
    expect(chip.appearance).toBe('raised')
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
      ? currentTheme.accent.primary : currentTheme.redesign.card)
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

describe.each(['orange', 'orangeDark'] as const)('%s Stitch inbox structure', mode => {
  beforeEach(() => { currentTheme = themes[mode] })

  it('uses a solid exact-count badge, neutral pill read-all and aligned kind/time rows', async () => {
    const screen = await renderScreen(<NotificationsScreen />)
    const badgeText = screen.getByText('32 mới')
    let badge = badgeText.parent
    while (badge && !StyleSheet.flatten(badge.props.style)?.backgroundColor) badge = badge.parent
    expect(StyleSheet.flatten(badge!.props.style).backgroundColor).toBe(currentTheme.accent.primary)
    expect(StyleSheet.flatten(badgeText.props.style).color).toBe(currentTheme.accent.onAccent)
    const readAll = screen.getByRole('button', { name: 'Đọc tất cả' })
    expect(StyleSheet.flatten(readAll.props.style)).toMatchObject({ borderRadius: 999, backgroundColor: currentTheme.redesign.high })
    expect(screen.getByTestId('material-icon-doneAll', { includeHiddenElements: true })).toBeTruthy()
    expect(StyleSheet.flatten(screen.getByTestId(`notification-heading-${item.id}`).props.style)).toMatchObject({ flexDirection: 'row', alignItems: 'flex-start' })
    expect(StyleSheet.flatten(screen.getByTestId(`notification-heading-${item.id}`).props.style).flexWrap).toBeUndefined()
    expect(StyleSheet.flatten(screen.getByTestId(`notification-icon-${item.id}`).props.style)).toMatchObject({ width: 48, height: 48 })
    expect(StyleSheet.flatten(screen.getByTestId(`notification-unread-${item.id}`).props.style).backgroundColor).toBe(currentTheme.accent.primary)
    expect(screen.getByRole('button', { name: 'Để sau' }).props.accessibilityHint).toBe(viMessages['g10.laterHint'])
  })

  it.each(['loading', 'empty', 'error'] as const)('keeps the heading and filters above the %s state', async state => {
    mockInbox = state === 'loading' ? { isPending: true } : state === 'error'
      ? { isError: true, error: new Error('network'), refetch: mockRefetch } : loadedInbox([])
    const screen = await renderScreen(<NotificationsScreen />)
    expect(screen.getByRole('header', { name: 'Tất cả thông báo' })).toBeTruthy()
    expect(screen.getByText('Tất cả')).toBeTruthy()
    if (state === 'loading') expect(screen.getByTestId('notifications-loading')).toBeTruthy()
    else {
      const surface = screen.getByTestId(state === 'error' ? 'notifications-error' : 'notifications-empty')
      expect(StyleSheet.flatten(surface.props.style).backgroundColor).toBe(currentTheme.redesign.card)
      expect(screen.queryByTestId('notifications-loading')).toBeNull()
      if (state === 'empty') {
        expect(screen.getByText(viMessages['g10.emptyTitle'])).toBeTruthy()
        expect(screen.getAllByTestId('material-icon-markChatRead', { includeHiddenElements: true })).toHaveLength(1)
        await fireEvent.press(screen.getByRole('button', { name: 'Tải lại thông báo' }))
        expect(mockRefetch).toHaveBeenCalledTimes(2)
      } else {
        expect(screen.queryByText(viMessages['g10.emptyTitle'])).toBeNull()
        await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }))
        expect(mockRefetch).toHaveBeenCalledTimes(2)
      }
    }
  })

  it.each(['anonymous', 'guest'])('%s sees unavailable public structure and personal sign-in, with no cached private data', async status => {
    mockSession = status
    // Both disabled account queries deliberately retain another account's cache.
    const fetch = jest.spyOn(globalThis, 'fetch')
    const screen = await renderScreen(<NotificationsScreen />)
    expect(screen.getByRole('header', { name: viMessages['g10.systemTitle'] })).toBeTruthy()
    expect(screen.getByTestId('system-notifications-unsupported')).toBeTruthy()
    expect(screen.getByText(viMessages['g10.systemUnavailableBody'])).toBeTruthy()
    expect(screen.getByRole('header', { name: viMessages['g10.personalTitle'] })).toBeTruthy()
    expect(screen.queryByText('Phòng "Phòng thật"')).toBeNull()
    expect(screen.queryByText('32 mới')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Đọc tất cả' })).toBeNull()
    expect(screen.queryByText(viMessages['g10.allNotifications'])).toBeNull()
    expect(chipSpy).not.toHaveBeenCalled()
    for (const key of ['g10.filter.all', 'g10.filter.invite', 'g10.filter.plan', 'g10.filter.date', 'g10.filter.system'] as const) {
      expect(screen.queryByText(viMessages[key])).toBeNull()
    }
    expect(screen.getByText(viMessages['g10.personalSignInBody'])).toBeTruthy()
    expect(mockInboxQuery).toHaveBeenLastCalledWith({ enabled: false, category: 'all' })
    expect(mockSummaryQuery).toHaveBeenLastCalledWith({ enabled: false })
    expect(fetch).not.toHaveBeenCalled()
    fetch.mockRestore()
    await fireEvent.press(screen.getByRole('button', { name: viMessages['auth.signInCta'] }))
    expect(mockPush).toHaveBeenCalledWith('/auth/sign-in')
    expect(mockReadAll).not.toHaveBeenCalled()
  })

  it('renders the supported row facts and read states without sample media or appointment details', async () => {
    mockInbox = loadedInbox([
      { id: 'prefs', kind: 'preference_reminder', payload: { preferenceProgress: { completedCount: 6, memberCount: 9 } } },
      { id: 'plan', kind: 'plan_ready', readAt: '2026-11-09T01:00:00Z', payload: { stopCount: 3 } },
      { id: 'change', kind: 'plan_changed', payload: { planChange: { action: 'edit', addedStopCount: 2 } } },
      { id: 'date', kind: 'date_reminder' },
    ])
    const screen = await renderScreen(<NotificationsScreen />)
    expect(screen.getByText('6/9 thành viên đã chọn xong')).toBeTruthy()
    expect(screen.getByText('3 điểm dừng')).toBeTruthy()
    expect(screen.getByText('Thêm 2 điểm dừng')).toBeTruthy()
    expect(screen.getByTestId('notification-unread-prefs')).toBeTruthy()
    expect(screen.queryByTestId('notification-unread-plan')).toBeNull()
    expect(screen.getByTestId('material-icon-dining', { includeHiddenElements: true })).toBeTruthy()
    expect(screen.queryByText(/19:00|15:30|The Workshop|Minh Triết|Sài Gòn|7 ngày/)).toBeNull()
  })

  it('uses the Stitch yesterday label for a one-day-old event', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 9, 10))
    try {
      mockInbox = loadedInbox([{ ...item, createdAt: '2026-11-08T10:00:00Z' }])
      const screen = await renderScreen(<NotificationsScreen />)
      expect(screen.getByText('Hôm qua')).toBeTruthy()
      expect(screen.queryByText('1 ngày trước')).toBeNull()
    } finally { now.mockRestore() }
  })
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
  mockInbox = loadedInbox()
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
  expect(failed.getByRole('button', { name: 'Đọc tất cả' })).toBeDisabled()
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

const NotificationCard = jest.requireActual<typeof import('@/features/notifications/notification-card.view')>('@/features/notifications/notification-card.view').NotificationCard
const fullCase = require('../../../test/fixtures/notifications-full-case.json') as { notifications: import('@/shared/api').Notification[] }
describe.each(['orange', 'orangeDark'] as const)('%s full notification fixture', mode => {
  beforeEach(() => { jest.useFakeTimers(); currentTheme = themes[mode]; mockInbox = loadedInbox(fullCase.notifications) })
  afterEach(async () => { await act(async () => { jest.runOnlyPendingTimers() }); jest.useRealTimers() })
  it('taps every chip, uses selected weight/highlight/a11y and restores all rows', async () => {
    const screen = await renderScreen(<NotificationsScreen />)
    for (const [label, kinds] of [
      ['Thành viên', ['invite']], ['Kế hoạch', ['preference_reminder', 'plan_ready', 'plan_changed']],
      ['Lịch hẹn', ['date_reminder']], ['Khác', ['campaign', 'moderation_update', 'privacy_export_ready', 'unknown']],
      ['Hệ thống', []],
      ['Tất cả', fullCase.notifications.map(row => row.kind)],
    ] as const) {
      await fireEvent.press(screen.getByRole('button', { name: label }))
      expect(screen.getByRole('button', { name: label }).props.accessibilityState).toMatchObject({ selected: true, disabled: false })
      const text = screen.getByText(label)
      expect(StyleSheet.flatten(text.props.style).fontFamily).toBe(fontFamily.semiBold)
      for (const other of ['Tất cả', 'Thành viên', 'Kế hoạch', 'Lịch hẹn', 'Khác', 'Hệ thống'].filter(value => value !== label)) {
        expect(screen.getByRole('button', { name: other }).props.accessibilityState.selected).toBe(false)
        expect(StyleSheet.flatten(screen.getByText(other).props.style).fontFamily).toBe(fontFamily.medium)
      }
      for (const row of fullCase.notifications) {
        const icon = screen.queryByTestId(`notification-icon-${row.id}`)
        expect(!!icon).toBe((kinds as readonly unknown[]).includes(row.kind))
      }
    }
  })
  it.each(fullCase.notifications)('renders $kind facts, semantic tile role, read state, time and supported actions', async row => {
      const screen = await renderScreen(<NotificationCard item={row} index={0} busy={false} reading={false} onOpen={mockResolve} onLater={mockRead} />)
      const tile = StyleSheet.flatten(screen.getByTestId(`notification-icon-${row.id}`).props.style)
      expect(tile.backgroundColor).toBe(row.kind === 'invite' || row.kind === 'preference_reminder' ? currentTheme.redesign.violetSoft
        : row.kind === 'plan_ready' ? currentTheme.redesign.greenSoft : currentTheme.redesign.high)
      expect(!!screen.queryByTestId(`notification-unread-${row.id}`)).toBe(!row.readAt)
      expect(screen.getByTestId(`notification-heading-${row.id}`)).toBeTruthy()
      if (row.kind === 'invite') expect(screen.getByRole('button', { name: 'Xem phòng' })).toBeTruthy()
      if (row.kind === 'plan_ready' || row.kind === 'plan_changed' || row.kind === 'date_reminder') expect(screen.getByRole('button', { name: 'Xem kế hoạch' })).toBeTruthy()
      expect(screen.getByText(row.kind === 'campaign' ? row.payload!.title! : i18n.t(`notifications.kind.${row.kind}`))).toBeTruthy()
      expect(screen.getByText(row.kind === 'campaign' ? row.payload!.body! : i18n.t(`notifications.body.${row.kind}`))).toBeTruthy()
      expect(screen.getByText(/trước|Hôm qua|Vừa xong/)).toBeTruthy()
      if (row.payload?.roomName) expect(screen.getByText(`Phòng "${row.payload.roomName}"`)).toBeTruthy()
      if (row.kind === 'invite') expect(screen.getByText('Người tạo lời mời: An Nguyễn')).toBeTruthy()
      if (row.kind === 'preference_reminder') expect(screen.getByText('3/5 thành viên đã chọn xong')).toBeTruthy()
      if (row.kind === 'plan_ready') expect(screen.getByText('3 điểm dừng')).toBeTruthy()
      if (row.kind === 'plan_changed') {
        for (const fact of ['Thêm 1 điểm dừng', 'Bỏ 1 điểm dừng', 'Đổi thứ tự 2 điểm dừng']) expect(screen.getByText(fact)).toBeTruthy()
      }
      if (row.kind === 'privacy_export_ready') expect(screen.getByText(/Hết hạn:/)).toBeTruthy()
  })
  it('shows the exact filter empty copy and a loading footer while searching more pages', async () => {
    mockInbox = { ...loadedInbox([item]), hasNextPage: true, isFetching: true, isFetchingNextPage: true }
    const screen = await renderScreen(<NotificationsScreen />)
    await fireEvent.press(screen.getByRole('button', { name: 'Lịch hẹn' }))
    expect(screen.getByTestId('notifications-loading-more')).toBeTruthy()
    expect(screen.queryByText('Không có thông báo loại này')).toBeNull()
    mockInbox = loadedInbox([item])
    await screen.rerender(<NotificationsScreen />)
    expect(screen.getByText('Không có thông báo loại này')).toBeTruthy()
    expect(screen.queryByTestId('notifications-loading-more')).toBeNull()
  })
  it.each([
    [0, 'Vừa xong', 'Just now'],
    [-60, 'Vừa xong', 'Just now'],
    [60, '1 phút trước', '1 minute ago'],
    [120, '2 phút trước', '2 minutes ago'],
    [3600, '1 giờ trước', '1 hour ago'],
    [7200, '2 giờ trước', '2 hours ago'],
    [86400, 'Hôm qua', 'Yesterday'],
    [4 * 86400, '4 ngày trước', '4 days ago'],
  ] as const)('uses identical personal/system relative time at age %s seconds in vi/en', async (seconds, vi, en) => {
    jest.setSystemTime(new Date('2026-11-09T10:00:00Z'))
    const publishedAt = new Date(Date.now() - seconds * 1000).toISOString()
    mockInbox = loadedInbox([{ ...item, createdAt: publishedAt }])
    mockSystemInbox = { status: 'supported', data: { pages: [{ items: [{ id: 'system-time', kind: 'maintenance', title: 'System time regression', body: 'Public body', publishedAt }] }] } }
    try {
      for (const [locale, expected] of [['vi', vi], ['en', en]] as const) {
        await act(async () => { await i18n.changeLanguage(locale) })
        const screen = await renderScreen(<NotificationsScreen />)
        expect(screen.getAllByText(expected)).toHaveLength(2)
        expect(screen.queryByText(new Date(publishedAt).toLocaleString(locale))).toBeNull()
        await screen.unmount()
      }
    } finally { await act(async () => { await i18n.changeLanguage('vi') }) }
  })
  it.each([null, 'not a date'])('omits invalid system publishedAt (%s) without hiding content', async publishedAt => {
    mockSystemInbox = { status: 'supported', data: { pages: [{ items: [{ id: 'system-time', kind: 'maintenance', title: 'System time regression', body: 'Public body', publishedAt }] }] } }
    const screen = await renderScreen(<NotificationsScreen />)
    const section = screen.getByTestId('system-notification-system-time')
    expect(screen.getByText('System time regression')).toBeTruthy()
    expect(screen.getByText('Public body')).toBeTruthy()
    expect(within(section).queryAllByText(/trước|Hôm qua|Vừa xong/)).toHaveLength(0)
    expect(screen.queryByText(/Invalid Date|NaN/)).toBeNull()
  })
  it.each(['user', 'guest'])('shows public rows for %s with independent read state', async status => {
    mockSession = status
    mockSystemInbox = { status: 'supported', data: { pages: [{ items: [{ id: 'system-1', kind: 'maintenance', title: 'Bảo trì GoGo', body: 'Bảo trì lúc 23:00.', deepLink: 'gogo://saved', publishedAt: '2026-11-09T01:00:00Z', expiresAt: null }] }] } }
    const screen = await renderScreen(<NotificationsScreen />)
    expect(screen.getByText('Bảo trì GoGo')).toBeTruthy()
    expect(screen.getByText('Bảo trì lúc 23:00.')).toBeTruthy()
    expect(screen.queryByTestId('notification-unread-system-1')).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Xem chi tiết' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/saved')
    expect(mockRead).not.toHaveBeenCalled()
  })
  it('shows public empty, loading, offline and error states independently of personal rows', async () => {
    mockSession = 'guest'
    mockSystemInbox = { status: 'supported', data: { pages: [{ items: [] }] } }
    const screen = await renderScreen(<NotificationsScreen />)
    expect(screen.getByText('Chưa có thông báo hệ thống')).toBeTruthy()
    mockSystemInbox = { status: 'pending', isPending: true }
    await screen.rerender(<NotificationsScreen />)
    expect(screen.getByTestId('system-notifications-loading')).toBeTruthy()
    mockSystemInbox = { status: 'pending', isPending: true, isPaused: true }
    await screen.rerender(<NotificationsScreen />)
    expect(screen.queryByTestId('system-notifications-loading')).toBeNull()
    mockSystemInbox = { status: 'error', isError: true, error: new Error('network'), refetch: mockRefetch }
    await screen.rerender(<NotificationsScreen />)
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }))
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })
})


const systemRow = (id: string, publishedAt: string) => ({ id, kind: 'maintenance', title: `Public ${id}`, body: 'Public body', deepLink: 'gogo://saved', publishedAt, expiresAt: null })
const mockSystemRefetch = jest.fn()
describe.each(['orange', 'orangeDark'] as const)('%s unified inbox', mode => {
  beforeEach(() => {
    currentTheme = themes[mode]
    mockSystemInbox = { status: 'supported', data: { pages: [
      { items: [systemRow('new', '2026-11-09T12:00:00Z'), systemRow('middle', '2026-11-09T09:00:00Z')] },
      { items: [systemRow('old', '2026-11-08T08:00:00Z')] },
    ] }, refetch: mockSystemRefetch }
    mockInbox = { ...loadedInbox([
      { ...item, id: 'personal-new', createdAt: '2026-11-09T10:00:00Z' },
      { ...item, id: 'personal-old', kind: 'campaign', createdAt: '2026-11-09T08:00:00Z', payload: { title: 'Private campaign' } },
    ]), hasNextPage: true }
  })
  const rows = (screen: Awaited<ReturnType<typeof renderScreen>>) => screen.getAllByTestId(/^(system-notification-|notification-heading-)/).map(row => row.props.testID)

  it.each(['user', 'guest'])('aligns public title/time and icon with personal rows for %s', async status => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-11-09T14:00:00Z').getTime())
    try {
      mockSession = status
      const screen = await renderScreen(<NotificationsScreen />)
      const sharedRows = notificationRowSpy.mock.calls.map(([props]) => props)
      expect(sharedRows.some(row => row.id === 'new')).toBe(true)
      if (status === 'user') expect(sharedRows.some(row => row.id === 'personal-new')).toBe(true)
      const row = screen.getByTestId('system-notification-new')
      const heading = within(row).getByTestId('notification-public-heading-new')
      expect(StyleSheet.flatten(heading.props.style)).toMatchObject({ flexDirection: 'row', alignItems: 'flex-start' })
      const title = within(heading).getByText('Public new')
      expect(title.props.numberOfLines).toBe(2)
      expect(title.props.ellipsizeMode).toBe('tail')
      expect(StyleSheet.flatten(title.props.style)).toMatchObject({ flex: 1, minWidth: 0, fontFamily: fontFamily.semiBold })
      expect(within(heading).getByText('2 giờ trước')).toBeTruthy()
      expect(within(heading).queryByText('Public body')).toBeNull()
      expect(within(row).getByText('Public body')).toBeTruthy()
      expect(StyleSheet.flatten(screen.getByTestId('notification-icon-new').props.style)).toMatchObject({ width: 48, height: 48 })
      expect(within(row).queryByTestId(/^notification-unread-/)).toBeNull()
      if (status === 'user') {
        const personalHeading = screen.getByTestId('notification-heading-personal-new')
        expect(StyleSheet.flatten(personalHeading.props.style)).toEqual(StyleSheet.flatten(heading.props.style))
        expect(within(personalHeading).getByText('4 giờ trước')).toBeTruthy()
      }
    } finally { now.mockRestore() }
  })

  it('places the signed-in toolbar under the header without removed-section spacing', async () => {
    const screen = await renderScreen(<NotificationsScreen />)
    const section = screen.getByTestId('notifications-personal-section')
    expect(StyleSheet.flatten(section.props.style)?.marginTop ?? 0).toBe(0)
    expect(within(section).getByRole('header', { name: 'Tất cả thông báo' })).toBeTruthy()
    expect(screen.queryByTestId('system-notifications-section')).toBeNull()
  })

  it('interleaves publishedAt/createdAt and releases older system rows with the personal page boundary', async () => {
    const screen = await renderScreen(<NotificationsScreen />)
    expect(screen.queryByTestId('system-notifications-section')).toBeNull()
    expect(screen.queryByRole('header', { name: 'Thông báo hệ thống' })).toBeNull()
    expect(rows(screen)).toEqual(['system-notification-new', 'notification-heading-personal-new', 'system-notification-middle', 'notification-heading-personal-old'])
    mockInbox = { ...loadedInbox([
      ...((mockInbox.data as { pages: { notifications: unknown[] }[] }).pages[0]!.notifications),
      { ...item, id: 'personal-page2', createdAt: '2026-11-08T07:00:00Z' },
    ]), hasNextPage: true }
    await screen.rerender(<NotificationsScreen />)
    expect(rows(screen)).toEqual(['system-notification-new', 'notification-heading-personal-new', 'system-notification-middle', 'notification-heading-personal-old', 'system-notification-old', 'notification-heading-personal-page2'])
  })
  it('releases the system tail when the personal cursor is exhausted, including an empty inbox', async () => {
    mockInbox = { ...mockInbox, hasNextPage: false }
    const screen = await renderScreen(<NotificationsScreen />)
    expect(rows(screen).at(-1)).toBe('system-notification-old')
    mockInbox = loadedInbox([])
    await screen.rerender(<NotificationsScreen />)
    expect(rows(screen)).toEqual(['system-notification-new', 'system-notification-middle', 'system-notification-old'])
    expect(screen.queryByText(viMessages['g10.emptyTitle'])).toBeNull()
    expect(screen.getByRole('button', { name: 'Đọc tất cả' })).toBeDisabled()
  })
  it('waits for the initial personal boundary before merging, while the system chip works independently', async () => {
    mockInbox = { isPending: true }
    const screen = await renderScreen(<NotificationsScreen />)
    expect(screen.queryAllByTestId(/^system-notification-/)).toHaveLength(0)
    expect(screen.getByTestId('notifications-loading')).toBeTruthy()
    await fireEvent.press(screen.getByRole('button', { name: 'Hệ thống' }))
    expect(rows(screen)).toEqual(['system-notification-new', 'system-notification-middle', 'system-notification-old'])
    expect(screen.queryByTestId('notifications-loading')).toBeNull()
  })
  it.each(['loading', 'offline', 'empty'] as const)('keeps personal rows usable when public data is %s', async state => {
    mockSystemInbox = state === 'empty' ? { status: 'supported', data: { pages: [{ items: [] }] } }
      : { isPending: true, isPaused: state === 'offline' }
    const screen = await renderScreen(<NotificationsScreen />)
    expect(screen.getByTestId('notification-heading-personal-new')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Đọc tất cả' })).toBeEnabled()
    await fireEvent.press(screen.getByRole('button', { name: 'Hệ thống' }))
    expect(screen.queryAllByTestId(/^notification-heading-/)).toHaveLength(0)
    if (state === 'loading') expect(screen.getByTestId('system-notifications-loading')).toBeTruthy()
    if (state === 'offline') expect(screen.getByText(viMessages['common.offlineTitle'])).toBeTruthy()
    if (state === 'empty') expect(screen.getByText(viMessages['g10.systemEmpty'])).toBeTruthy()
  })
  it('loads more personal rows at the end of All but not on the public chip', async () => {
    const fetchNextPage = jest.fn().mockResolvedValue(undefined)
    mockInbox = { ...mockInbox, fetchNextPage }
    const screen = await renderScreen(<NotificationsScreen />)
    const list = () => screen.getByTestId('notifications-feed')
    await fireEvent(list(), 'endReached')
    expect(fetchNextPage).toHaveBeenCalledWith({ cancelRefetch: false })
    await fireEvent.press(screen.getByRole('button', { name: 'Hệ thống' }))
    await fireEvent(list(), 'endReached')
    expect(fetchNextPage).toHaveBeenCalledTimes(1)
  })
  it('keeps all personal chips private and shows the full public list only on Hệ thống', async () => {
    mockInbox = { ...mockInbox, hasNextPage: false }
    const screen = await renderScreen(<NotificationsScreen />)
    for (const label of ['Thành viên', 'Kế hoạch', 'Lịch hẹn', 'Khác']) {
      await fireEvent.press(screen.getByRole('button', { name: label }))
      expect(screen.queryAllByTestId(/^system-notification-/)).toHaveLength(0)
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Hệ thống' }))
    expect(rows(screen)).toEqual(['system-notification-new', 'system-notification-middle', 'system-notification-old'])
    expect(screen.queryAllByTestId(/^notification-heading-/)).toHaveLength(0)
    expect(mockInboxQuery).toHaveBeenLastCalledWith({ enabled: true, category: 'all' })
    expect(screen.getByRole('button', { name: 'Đọc tất cả' })).toBeDisabled()
  })
  it('never marks public rows unread or sends them to read actions', async () => {
    const screen = await renderScreen(<NotificationsScreen />)
    for (const row of screen.getAllByTestId(/^system-notification-/)) {
      expect(within(row).queryByTestId(/^notification-unread-/)).toBeNull()
      expect(StyleSheet.flatten(row.props.style).backgroundColor).toBe(currentTheme.redesign.card)
    }
    expect(screen.getByText('32 mới')).toBeTruthy()
    await fireEvent.press(within(screen.getByTestId('system-notification-new')).getByRole('button', { name: 'Xem chi tiết' }))
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/saved')
    expect(mockRead).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole('button', { name: 'Đọc tất cả' }))
    expect(mockReadAll).toHaveBeenCalledWith('opaque-summary-cutoff')
  })
  it.each([false, true])('isolates system failure (cached: %s) with a small public retry', async cached => {
    mockSystemInbox = { ...mockSystemInbox, data: cached ? mockSystemInbox.data : undefined, isError: true, error: new Error('503') }
    const screen = await renderScreen(<NotificationsScreen />)
    expect(screen.getByTestId('notification-heading-personal-new')).toBeTruthy()
    expect(screen.queryByTestId('notifications-error')).toBeNull()
    expect(screen.queryByText(viMessages['common.errorTitle'])).toBeNull()
    expect(screen.getByText('32 mới')).toBeTruthy()
    const retry = screen.getByTestId('system-notifications-retry')
    await fireEvent.press(within(retry).getByRole('button', { name: 'Thử lại' }))
    expect(mockSystemRefetch).toHaveBeenCalledTimes(1)
    expect(mockRefetch).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByRole('button', { name: 'Hệ thống' }))
    expect(screen.queryByText('Không có thông báo loại này')).toBeNull()
    expect(screen.getByTestId('system-notifications-retry')).toBeTruthy()
  })
  it.each(['anonymous', 'guest'])('preserves the public section and sign-in prompt for %s', async status => {
    mockSession = status
    const screen = await renderScreen(<NotificationsScreen />)
    expect(screen.getByTestId('system-notifications-section')).toBeTruthy()
    expect(screen.getByRole('header', { name: 'Thông báo hệ thống' })).toBeTruthy()
    expect(screen.getByText(viMessages['g10.personalSignInBody'])).toBeTruthy()
    expect(rows(screen)).toEqual(['system-notification-new', 'system-notification-middle', 'system-notification-old'])
    expect(chipSpy).not.toHaveBeenCalled()
    expect(screen.queryByText('32 mới')).toBeNull()
  })
})

describe.each(['orange', 'orangeDark'] as const)('%s inbox error regression', mode => {
  beforeEach(() => { currentTheme = themes[mode] })
  it('keeps toolbar geometry across loading, unread, zero, error, busy and every chip', async () => {
    mockInbox = { isPending: true }
    mockSummary = { isPending: true }
    const screen = await renderScreen(<NotificationsScreen />)
    const toolbarStyle = () => StyleSheet.flatten(screen.getByTestId('notifications-toolbar').props.style)
    const initial = toolbarStyle()
    expect(initial).toMatchObject({ height: buttonSizes.small.minHeight, flexDirection: 'row', alignItems: 'center' })
    expect(initial.flexWrap).toBeUndefined()
    const check = (disabled: boolean) => {
      expect(toolbarStyle()).toEqual(initial)
      const button = screen.getByRole('button', { name: 'Đọc tất cả' })
      expect(StyleSheet.flatten(button.props.style)).toMatchObject({ height: initial.height, minHeight: initial.height, flexShrink: 0 })
      expect(button.props.accessibilityState.disabled).toBe(disabled)
      expect(button.props.accessibilityHint).toBe(disabled ? viMessages['g10.readAllDisabledHint'] : undefined)
      expect(screen.getByRole('header', { name: 'Tất cả thông báo' }).props.numberOfLines).toBe(1)
    }
    check(true)
    expect(screen.queryByText('0 mới')).toBeNull()
    mockInbox = loadedInbox()
    mockSummary = { data: { unreadCount: 32, readThroughCursor: 'cutoff' } }
    await screen.rerender(<NotificationsScreen />)
    check(false)
    expect(screen.getByText('32 mới')).toBeTruthy()
    for (const label of ['Thành viên', 'Kế hoạch', 'Lịch hẹn', 'Khác', 'Hệ thống', 'Tất cả']) {
      await fireEvent.press(screen.getByRole('button', { name: label }))
      // This fixture has only an invite; the other personal filters are empty.
      check(label !== 'Thành viên' && label !== 'Tất cả')
    }
    mockReadAllPending = true
    await screen.rerender(<NotificationsScreen />)
    check(true)
    mockReadAllPending = false
    mockSummary = { data: { unreadCount: 0, readThroughCursor: 'cutoff' } }
    await screen.rerender(<NotificationsScreen />)
    check(true)
    const badge = screen.getByTestId('notifications-unread-badge', { includeHiddenElements: true })
    expect(StyleSheet.flatten(badge.props.style)).toMatchObject({ opacity: 0, flexShrink: 0 })
    expect(badge.props.accessibilityElementsHidden).toBe(true)
    expect(badge.props.importantForAccessibility).toBe('no-hide-descendants')
    await fireEvent.press(screen.getByRole('button', { name: 'Đọc tất cả' }))
    expect(mockReadAll).not.toHaveBeenCalled()
    mockSummary = { isError: true, error: new Error('503'), refetch: mockRefetch }
    mockInbox = { isError: true, error: new Error('503'), refetch: mockRefetch }
    await screen.rerender(<NotificationsScreen />)
    check(true)
  })
  it.each([{ rows: [] }, { rows: [item] }])('shows one stale notice for cached list + summary failures ($rows.length rows)', async ({ rows }) => {
    mockInbox = { ...loadedInbox(rows), isError: true, error: new Error('503') }
    mockSummary = { ...mockSummary, isError: true, error: new Error('503') }
    const screen = await renderScreen(<NotificationsScreen />)
    expect(screen.getAllByText(viMessages['common.staleError'])).toHaveLength(1)
    expect(screen.queryByText('32 mới')).toBeNull()
    expect(screen.getByRole('button', { name: 'Đọc tất cả' })).toBeDisabled()
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }))
    expect(mockRefetch).toHaveBeenCalledTimes(2)
    expect(screen.queryByTestId('notifications-error')).toBeNull()
  })
  it('renders shared ErrorState in the list card with no empty copy or duplicate error retry', async () => {
    mockInbox = { isError: true, error: new Error('503'), refetch: mockRefetch }
    mockSummary = { isError: true, error: new Error('503'), refetch: mockRefetch }
    const screen = await renderScreen(<NotificationsScreen />)
    const card = screen.getByTestId('notifications-error')
    expect(StyleSheet.flatten(card.props.style).backgroundColor).toBe(currentTheme.redesign.card)
    expect(screen.getByText(viMessages['common.errorTitle'])).toBeTruthy()
    expect(screen.queryByText(viMessages['g10.emptyTitle'])).toBeNull()
    expect(screen.queryByText(viMessages['common.staleError'])).toBeNull()
    expect(screen.getByRole('button', { name: 'Đọc tất cả' })).toBeDisabled()
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }))
    expect(mockRefetch).toHaveBeenCalledTimes(2)
  })
  it.each(['zero', 'unknown', 'error', 'empty'] as const)('disables read-all for %s and hides zero/unknown/error badge', async state => {
    if (state === 'zero') mockSummary = { ...mockSummary, data: { unreadCount: 0, readThroughCursor: 'cutoff' } }
    if (state === 'unknown') mockSummary = { refetch: mockRefetch }
    if (state === 'error') mockSummary = { ...mockSummary, isError: true, error: new Error('503') }
    if (state === 'empty') mockInbox = loadedInbox([])
    const screen = await renderScreen(<NotificationsScreen />)
    expect(screen.getByRole('button', { name: 'Đọc tất cả' })).toBeDisabled()
    expect(screen.queryByText('0 mới')).toBeNull()
    if (state !== 'empty') expect(screen.queryByText('32 mới')).toBeNull()
    expect(mockReadAll).not.toHaveBeenCalled()
  })
  it('passes the selected chip to the server query', async () => {
    const screen = await renderScreen(<NotificationsScreen />)
    await fireEvent.press(screen.getByRole('button', { name: 'Kế hoạch' }))
    expect(mockInboxQuery).toHaveBeenLastCalledWith({ enabled: true, category: 'plan' })
  })
})


const categoryChoices = { invite: true, preference_reminder: false, plan_ready: true, plan_changed: false, date_reminder: true }
const categorySettings = (pushEnabled = false) => ({ ...settingsData, pushEnabled, version: '9007199254740993', etag: '"settings-opaque-v12"', categories: categoryChoices })
const sourced = (value: string) => ({ value, sourceType: 'gogo', originType: 'editorial', verifiedAt: '2026-11-09T00:00:00Z' })
const mediaKey = `avatars/${'a'.repeat(32)}.webp`
const placeId = '22222222-2222-4222-8222-222222222222'
const mediaId = '33333333-3333-4333-8333-333333333333'
const startsAt = '2026-11-09T12:00:00Z'
const eventPreview = {
  planId: '44444444-4444-4444-8444-444444444444', planVersion: 2, constraintVersion: 3,
  capturedAt: '2026-11-09T09:00:00Z', stopCount: 2, startAt: startsAt, startAtSource: 'room_constraints',
  stops: [{ position: 0, placeId, mediaId, name: sourced('Quán GoGo'), addressText: sourced('27 Đường GoGo') },
    { position: 1, placeId, name: sourced('Bếp GoGo') }],
}

describe.each(['orange', 'orangeDark'] as const)('event-time facts and category preferences in %s', mode => {
  beforeEach(() => { currentTheme = themes[mode] })

  it('renders event-time inviter, exact GoGo thumbnail, ordered stops, start time and client countdown', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-09T10:00:00Z'))
    mockMembersRead.mockReturnValue({ data: [{ avatarUrl: `https://media.gogo.id.vn/${mediaKey}` }] })
    mockPlaceRead.mockReturnValue({ data: { photos: [
      { id: 'unrelated', source: 'manual', url: 'https://media.gogo.id.vn/wrong.webp' },
      { id: mediaId, source: 'community', url: '/v1/media/gogo.webp' },
    ] } })
    mockInbox = loadedInbox([
      { ...item, payload: { ...item.payload, inviterName: 'Nguyễn Lan', inviterAvatar: { sourceType: 'gogo', mediaKey } } },
      { id: 'ready', kind: 'plan_ready', payload: { planPreview: eventPreview } },
      { id: 'changed', kind: 'plan_changed', payload: { planPreview: { ...eventPreview, stops: [] } } },
      { id: 'date', kind: 'date_reminder', payload: { reminder: { trigger: 'scheduled', startsAt }, planPreview: eventPreview } },
    ])
    try {
      const screen = await renderScreen(<NotificationsScreen />)
      expect(screen.getByText('1. Quán GoGo • 2. Bếp GoGo')).toBeTruthy()
      expect(screen.getByText('Còn 2 giờ nữa là đến giờ hẹn')).toBeTruthy()
      expect(screen.getByText('Quán GoGo')).toBeTruthy()
      expect(screen.getByText('27 Đường GoGo')).toBeTruthy()
      expect(screen.getAllByRole('button').some(control => control.props.accessibilityLabel?.includes('Quán GoGo'))).toBe(true)
      const time = new Date(startsAt).toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' })
      expect(screen.getAllByText(`Bắt đầu lúc ${time}`)).toHaveLength(3)
      expect(screen.getByTestId('notification-plan-thumbnail').props.source[0].uri).toMatch(/\/v1\/media\/gogo.webp$/)
      const avatar = screen.getByTestId('avatar-image')
      expect(avatar.props.source[0].uri).toBe(`https://media.gogo.id.vn/${mediaKey}`)
      await fireEvent(avatar, 'load', { nativeEvent: {} })
      await fireEvent(avatar, 'error', { nativeEvent: {} })
      expect(screen.getByText('NL')).toBeTruthy()
      expect(mockMembersRead).toHaveBeenCalledWith(item.payload.roomId)
      expect(mockPlaceRead).toHaveBeenCalledWith(placeId)
    } finally { now.mockRestore() }
  })

  it('keeps legacy rendering and makes no media reads when facts are absent', async () => {
    mockInbox = loadedInbox(['invite', 'preference_reminder', 'plan_ready', 'plan_changed', 'date_reminder'].map(kind => ({ id: kind, kind })))
    const screen = await renderScreen(<NotificationsScreen />)
    for (const kind of ['invite', 'preference_reminder', 'plan_ready', 'plan_changed', 'date_reminder'] as const) {
      expect(screen.getByText(viMessages[`notifications.body.${kind}`])).toBeTruthy()
    }
    expect(screen.queryByTestId('notification-plan-preview')).toBeNull()
    expect(screen.queryByTestId('notification-appointment')).toBeNull()
    expect(screen.queryByTestId('avatar-image')).toBeNull()
    expect(mockMembersRead).not.toHaveBeenCalled()
    expect(mockPlaceRead).not.toHaveBeenCalled()
  })

  it('uses initials for unavailable inviter media and hides Google or unrelated place imagery', async () => {
    mockMembersRead.mockReturnValue({ data: [{ avatarUrl: 'https://foreign.example/avatar.jpg' }] })
    mockPlaceRead.mockReturnValue({ data: { photos: [{ id: mediaId, source: 'google', url: 'https://google.example/photo.jpg' }] } })
    mockInbox = loadedInbox([
      { ...item, payload: { ...item.payload, inviterName: 'Nguyễn Lan', inviterAvatar: { sourceType: 'gogo', mediaKey } } },
      { id: 'ready', kind: 'plan_ready', payload: { planPreview: { ...eventPreview, stops: [
        { position: 0, placeId, mediaId, name: { ...sourced('Google name'), sourceType: 'google' }, addressText: { ...sourced('Google address'), sourceType: 'google' } },
      ] } } },
    ])
    const screen = await renderScreen(<NotificationsScreen />)
    expect(screen.getByText('NL')).toBeTruthy()
    expect(screen.queryByTestId('avatar-image')).toBeNull()
    expect(screen.queryByTestId('notification-plan-thumbnail')).toBeNull()
    expect(screen.queryByText(/Google name|Google address/)).toBeNull()
  })

  it.each(['room_started', 'scheduled'] as const)('never shows negative hours for %s after the start', async trigger => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.parse(startsAt) + 60000)
    mockInbox = loadedInbox([{ id: 'date', kind: 'date_reminder', payload: { reminder: { trigger, startsAt } } }])
    try {
      const screen = await renderScreen(<NotificationsScreen />)
      expect(screen.queryByText('Đã đến giờ hẹn')).toBeNull()
      expect(screen.queryByText(/Còn .*giờ/)).toBeNull()
    } finally { now.mockRestore() }
  })

  it('recomputes the countdown on app resume and uses the start instant for room_started', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.parse(startsAt) - 30 * 60000)
    mockInbox = loadedInbox([{ id: 'scheduled', kind: 'date_reminder', payload: { reminder: { trigger: 'scheduled', startsAt } } }])
    try {
      const screen = await renderScreen(<NotificationsScreen />)
      const resume = jest.mocked(AppState.addEventListener).mock.calls.at(-1)?.[1] as ((state: AppStateStatus) => void) | undefined
      expect(screen.getByText('Còn 30 phút nữa là đến giờ hẹn')).toBeTruthy()
      now.mockReturnValue(Date.parse(startsAt))
      await act(async () => { resume?.('active') })
      expect(screen.getByText('Đã đến giờ hẹn')).toBeTruthy()
      expect(screen.queryByText(/Còn .*phút/)).toBeNull()
      now.mockReturnValue(Date.parse(startsAt) - 2 * 3600000)
      mockInbox = loadedInbox([{ id: 'started', kind: 'date_reminder', payload: { reminder: { trigger: 'room_started', startsAt } } }])
      const started = await renderScreen(<NotificationsScreen />)
      expect(started.queryByText('Đã đến giờ hẹn')).toBeNull()
      expect(started.getByText('Còn 2 giờ nữa là đến giờ hẹn')).toBeTruthy()
    } finally { now.mockRestore() }
  })

  it.each(['scheduled', 'room_started'] as const)('uses full ISO dates and the device calendar for %s', async trigger => {
    const start = '2026-11-10T17:28:00+07:00'
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-09T17:06:00+07:00'))
    mockInbox = loadedInbox([{ id: 'tomorrow', kind: 'date_reminder', payload: { reminder: { trigger, startsAt: start } } }])
    try {
      const screen = await renderScreen(<NotificationsScreen />)
      const local = new Date(start)
      const time = local.toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' })
      const date = `${String(local.getDate()).padStart(2, '0')}/${String(local.getMonth() + 1).padStart(2, '0')}`
      expect(screen.getByText('Còn 25 giờ nữa là đến giờ hẹn')).toBeTruthy()
      expect(screen.getByText(`Bắt đầu ${time} · ${date}`)).toBeTruthy()
      expect(screen.queryByText('Đã đến giờ hẹn')).toBeNull()
    } finally { now.mockRestore() }
  })

  it.each([
    [-120 * 60000, 'Còn 2 giờ nữa là đến giờ hẹn'],
    [-30 * 60000, 'Còn 30 phút nữa là đến giờ hẹn'],
    [0, 'Đã đến giờ hẹn'],
    [60000, null],
  ])('renders the reminder at start offset %s', async (offset, copy) => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.parse(startsAt) + offset)
    mockInbox = loadedInbox([{ id: 'date', kind: 'date_reminder', payload: { reminder: { trigger: 'room_started', startsAt } } }])
    try {
      const screen = await renderScreen(<NotificationsScreen />)
      if (copy) expect(screen.getByText(copy)).toBeTruthy()
      else expect(screen.queryByText(/Còn .*|Đã đến giờ hẹn/)).toBeNull()
      const time = new Date(startsAt).toLocaleTimeString('vi', { hour: '2-digit', minute: '2-digit' })
      expect(screen.getByText(`Bắt đầu lúc ${time}`)).toBeTruthy()
    } finally { now.mockRestore() }
  })

  it('omits unavailable/failed GoGo media without replacing it with another photo', async () => {
    mockPlaceRead.mockReturnValue({ data: { photos: [{ id: 'different', source: 'manual', url: 'https://media.gogo.id.vn/wrong.webp' }] } })
    mockInbox = loadedInbox([{ id: 'ready', kind: 'plan_ready', payload: { planPreview: eventPreview } }])
    const absent = await renderScreen(<NotificationsScreen />)
    expect(absent.queryByTestId('notification-plan-thumbnail')).toBeNull()
    expect(absent.getByText('1. Quán GoGo • 2. Bếp GoGo')).toBeTruthy()
    mockPlaceRead.mockReturnValue({ data: { photos: [{ id: mediaId, source: 'manual', url: 'https://media.gogo.id.vn/real.webp' }] } })
    const loaded = await renderScreen(<NotificationsScreen />)
    await fireEvent(loaded.getByTestId('notification-plan-thumbnail'), 'error', { nativeEvent: {} })
    expect(loaded.queryByTestId('notification-plan-thumbnail')).toBeNull()
    expect(loaded.getByText('1. Quán GoGo • 2. Bếp GoGo')).toBeTruthy()
  })

  it('omits invalid/missing start times and unverified venue text', async () => {
    mockInbox = loadedInbox([{ id: 'date', kind: 'date_reminder', payload: {
      reminder: { trigger: 'scheduled', startsAt: 'invalid' },
      planPreview: { ...eventPreview, stops: [{ position: 0, placeId, name: { ...sourced('Unverified'), verifiedAt: 'invalid' } }] },
    } }])
    const screen = await renderScreen(<NotificationsScreen />)
    expect(screen.queryByTestId('notification-appointment')).toBeNull()
    expect(screen.queryByText(/Unverified|Còn .*giờ|Bắt đầu lúc/)).toBeNull()
  })

  it('wires all five category preferences while master is off; enable all never changes master', async () => {
    mockSettings = { ...mockSettings, data: categorySettings() }
    const screen = await renderScreen(<SettingsScreen />)
    expect(screen.queryByText(viMessages['g10.categoriesUnavailable'])).toBeNull()
    expect(screen.getByText('3/5 loại đang bật')).toBeTruthy()
    expect(screen.getByText(viMessages['g10.masterPaused'])).toBeTruthy()
    expect(screen.getByTestId('notification-master').props.value).toBe(false)
    for (const [category, enabled] of Object.entries(categoryChoices)) {
      const control = screen.getByTestId(`notification-category-${category}`)
      expect(control.props.value).toBe(enabled)
      expect(control.props.disabled).toBe(false)
      await fireEvent(control, 'valueChange', !enabled)
      expect(mockSave).toHaveBeenLastCalledWith({ categories: { [category]: !enabled } })
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Bật tất cả' }))
    expect(mockSave).toHaveBeenLastCalledWith({ categories: { invite: true, preference_reminder: true, plan_ready: true, plan_changed: true, date_reminder: true } })
    expect(mockSave.mock.calls.every(([body]) => !('pushEnabled' in body))).toBe(true)
    expect(screen.getByTestId('notification-master').props.value).toBe(false)
    expect(screen.getByTestId('notification-quiet-hours').props.disabled).toBe(true)
    await fireEvent(screen.getByTestId('notification-master'), 'valueChange', true)
    expect(mockSave).toHaveBeenLastCalledWith({ pushEnabled: true })
  })

  it('locks category preferences during save/refetch/offline, and retains server values on failure', async () => {
    mockSettings = { ...mockSettings, data: categorySettings(), isFetching: true }
    const screen = await renderScreen(<SettingsScreen />)
    expect(screen.getByTestId('notification-category-invite').props.disabled).toBe(true)
    await fireEvent(screen.getByTestId('notification-category-invite'), 'valueChange', false)
    expect(mockSave).not.toHaveBeenCalled()
    mockSettings = { ...mockSettings, isFetching: false }
    mockSavePending = true
    const pending = await renderScreen(<SettingsScreen />)
    expect(pending.getByTestId('notification-category-invite').props.disabled).toBe(true)
    expect(pending.getByTestId('notification-master').props.disabled).toBe(true)
    mockSavePending = false
    mockSaveError = true
    const failed = await renderScreen(<SettingsScreen />)
    expect(failed.getByTestId('notification-category-invite').props.value).toBe(true)
    expect(failed.getByText(viMessages['notificationSettings.saveFailed'])).toBeTruthy()
  })
})
