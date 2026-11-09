import { act, fireEvent, waitFor } from '@testing-library/react-native'
import { onlineManager } from '@tanstack/react-query'
import { AccessibilityInfo, RefreshControl } from 'react-native'
import { motion } from '@/shared/ui/tokens'

import { loaded, loaded as mockLoaded, renderScreen, type QueryLike } from './harness'

/**
 * ADM-204 (#209) — Home searches in the scope it resolved, says which scope the
 * server applied, and offers an honest way forward when there is none.
 */

const mockRoomRefetch = jest.fn(async () => undefined)
const mockInboxRefetch = jest.fn(async () => undefined)
jest.mock('@/features/notifications/unread-count', () => ({
  useUnreadInbox: () => ({ count: 0, more: false, refetch: mockInboxRefetch }),
}))
const mockPush = jest.fn()
const mockSession = { status: 'user' as string }
const mockMe: { query: QueryLike } = { query: loaded({ homeAdministrativeArea: null }) }
const mockScope: { value: unknown } = { value: { status: 'resolving' } }
const mockRetryScope = jest.fn(async () => undefined)
const mockRecheck = jest.fn(async () => undefined)
const mockRequest = jest.fn(async () => ({ status: 'granted', lat: 10.77, lng: 106.7, label: null }))
const mockSearchCalls: { query: Record<string, unknown>; options: { enabled?: boolean } }[] = []
const mockSearch: { value: Record<string, unknown> } = { value: {} }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: mockSession.status, session: null }),
}))
jest.mock('@/features/create-date/draft-resume.view', () => ({ DraftResume: () => null }))
jest.mock('@/shared/location/use-current-location', () => ({
  useCurrentLocation: () => ({ state: { status: 'idle' }, request: mockRequest }),
}))
jest.mock('@/shared/location/use-discovery-scope', () => ({
  ...jest.requireActual('@/shared/location/use-discovery-scope'),
  useDiscoveryScope: () => ({ scope: mockScope.value, recheck: mockRecheck, retry: mockRetryScope }),
}))
// The owner moved area selection into Home's sheet. Keep the real picker,
// with its own server reads supplied just like Home's search reads below.
jest.mock('@/shared/administrative/queries', () => ({
  ...jest.requireActual('@/shared/administrative/queries'),
  useAdministrativeVersion: () => mockLoaded({ datasetVersion: 'ds-2026' }),
  useAdministrativeUnits: () => mockLoaded([]),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useHomeRoom: () => ({ ...mockLoaded(undefined), refetch: mockRoomRefetch }),
  useTaxonomies: () => mockLoaded({ kinds: {} }),
  useJoinRoom: () => ({ mutateAsync: jest.fn() }),
  useMe: () => mockMe.query,
  useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: jest.fn() }),
  usePlaceSearch: (query: Record<string, unknown>, options: { enabled?: boolean }) => {
    mockSearchCalls.push({ query, options })
    return mockSearch.value
  },
}))

import { useDiscoveryAreaStore } from '@/features/search/discovery-area-store'
import HomeScreen from '@/features/home/home.view'
import { ApiError } from '@/shared/api/errors'
import { OFFLINE_SIGNAL_DELAY_MS } from '@/shared/api/queries/use-online-status'

const AREA = {
  datasetVersion: 'ds-2026',
  provinceCode: '79',
  provinceName: 'Thành phố Hồ Chí Minh',
  communeCode: '26734',
  communeName: 'Phường Bến Thành',
}

function page(location: unknown) {
  return {
    data: { pages: [{ results: [], nextCursor: null, meta: { location } }] },
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  }
}

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(element)
  })
}

beforeEach(() => {
  // The area sheet now stays mounted while hidden, so every Home render reads
  // the native preference. Keep unrelated scope tests on the instant path.
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
  useDiscoveryAreaStore.setState({ area: null })
  mockRoomRefetch.mockClear()
  mockInboxRefetch.mockClear()
  mockPush.mockClear()
  mockRecheck.mockClear()
  mockRetryScope.mockClear()
  mockRequest.mockClear()
  mockSearchCalls.length = 0
  mockSession.status = 'user'
  mockScope.value = { status: 'resolving' }
  mockSearch.value = page(undefined)
})
afterEach(() => jest.restoreAllMocks())

describe('Home discovery scope', () => {
  it('R12 retains the Home area sheet for its exit animation, then removes it', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] })
    const preference = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false)
    try {
      const view = await renderScreen(<HomeScreen />)
      await press(view.getByTestId('home-location'))
      expect(view.getByTestId('discovery-location-sheet')).toBeTruthy()
      await act(async () => { jest.advanceTimersByTime(motion.standard + 100) })
      await press(view.getAllByRole('button', { name: 'Đóng' })[0])
      expect(view.queryByTestId('discovery-location-sheet')).toBeNull()
      expect(view.getByTestId('discovery-location-sheet', { includeHiddenElements: true })).toBeTruthy()
      await act(async () => { jest.advanceTimersByTime(motion.standard + 100) })
      expect(view.queryByTestId('discovery-location-sheet', { includeHiddenElements: true })).toBeNull()
    } finally {
      preference.mockRestore()
      jest.clearAllTimers()
      jest.useRealTimers()
    }
  })

  it('waits for the scope before searching', async () => {
    mockSearch.value = { data: undefined, isPending: true, isError: false, error: null, refetch: jest.fn() }
    const view = await renderScreen(<HomeScreen />)
    expect(mockSearchCalls.at(-1)?.options.enabled).toBe(false)
    expect(view.queryByText('Gợi ý chung, chưa theo vị trí')).toBeNull()
  })

  it('searches near a fresh position and says so', async () => {
    mockScope.value = { status: 'ready', source: 'gps', position: { lat: 10.77, lng: 106.7 } }
    mockSearch.value = page({ source: 'gps' })
    const view = await renderScreen(<HomeScreen />)
    const last = mockSearchCalls.at(-1)!
    expect(last.options.enabled).toBe(true)
    expect(last.query).toMatchObject({ lat: 10.77, lng: 106.7 })
    expect(last.query).not.toHaveProperty('provinceCode')
    expect(view.getByTestId('home-location')).toBeTruthy()
    expect(view.queryByText('Gần vị trí hiện tại của bạn')).toBeNull()
  })

  it('searches in the shared account area and names it', async () => {
    useDiscoveryAreaStore.setState({ area: AREA })
    mockScope.value = { status: 'ready', source: 'profile_area', area: AREA }
    mockSearch.value = page({ source: 'administrative_area', area: AREA })
    const view = await renderScreen(<HomeScreen />)
    const last = mockSearchCalls.at(-1)!
    expect(last.query).toMatchObject({ datasetVersion: 'ds-2026', provinceCode: '79', communeCode: '26734' })
    expect(last.query).not.toHaveProperty('lat')
    expect(view.getByText('Phường Bến Thành, Thành phố Hồ Chí Minh')).toBeTruthy()
    expect(view.queryByText(/Theo khu vực tài khoản/)).toBeNull()
  })

  it('keeps the shared area visible when the server does not echo it', async () => {
    useDiscoveryAreaStore.setState({ area: AREA })
    mockScope.value = { status: 'ready', source: 'profile_area', area: AREA }
    mockSearch.value = page(undefined)
    const view = await renderScreen(<HomeScreen />)
    expect(view.getByText('Phường Bến Thành, Thành phố Hồ Chí Minh')).toBeTruthy()
    expect(view.getByTestId('home-location')).toBeTruthy()
    expect(view.queryByText(/Theo khu vực tài khoản/)).toBeNull()
  })

  it('offers location or an area when there is neither, and uses a granted fix', async () => {
    mockScope.value = { status: 'ready', source: 'none', reason: 'no_area' }
    mockSearch.value = page({ source: 'none' })
    const view = await renderScreen(<HomeScreen />)
    expect(view.getByTestId('home-location')).toBeTruthy()
    await press(view.getAllByText('Chọn khu vực').at(-1)!)
    expect(view.getByTestId('discovery-location-sheet')).toBeTruthy()
    await press(view.getAllByLabelText('Đóng').at(-1)!)
    await press(view.getByText('Dùng vị trí hiện tại'))
    expect(mockRequest).toHaveBeenCalledTimes(1)
    expect(mockRecheck).not.toHaveBeenCalled()
  })

  it('lets a guest choose an area and explains a replaced area', async () => {
    mockSession.status = 'guest'
    mockScope.value = { status: 'ready', source: 'none', reason: 'area_needs_reselection' }
    mockSearch.value = page({ source: 'none' })
    const view = await renderScreen(<HomeScreen />)
    expect(view.getByText(/cần chọn lại/)).toBeTruthy()
    await press(view.getAllByText('Chọn khu vực').at(-1)!)
    expect(view.getByTestId('discovery-location-sheet')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('explains an area from a replaced dataset instead of a generic failure', async () => {
    mockScope.value = { status: 'ready', source: 'profile_area', area: AREA }
    mockSearch.value = {
      data: undefined,
      isPending: false,
      isError: true,
      error: new ApiError(409, { code: 'ADMINISTRATIVE_VERSION_CHANGED', message: 'reselect' }),
      refetch: jest.fn(),
    }
    const view = await renderScreen(<HomeScreen />)
    expect(view.getByText(/Dữ liệu hành chính đã thay đổi/)).toBeTruthy()
    await press(view.getAllByText('Chọn khu vực').at(-1)!)
    expect(view.getByTestId('discovery-location-sheet')).toBeTruthy()
  })
})

/**
 * GoGo-MobileApp#253 — suggestions from an earlier search stay on Home when the
 * device goes offline; the screen has to say they are the saved copy.
 */
describe('Home × connectivity', () => {
  const OFFLINE = 'Đang ngoại tuyến — đây là bản đã lưu trên máy.'
  const RESULT = {
    id: 'place-1',
    name: 'Quán Gần Nhà',
    addressText: 'Quận 1',
    lat: 10.77,
    lng: 106.7,
    rating: 4.5,
    ratingCount: 12,
    distanceM: 300,
    reasonCodes: [],
    isLodging: false,
  }

  const FAILED = 'Chưa cập nhật được — đây là bản đã lưu trên máy.'
  const NO_CONNECTION = 'Không có kết nối'
  const withResults = () => ({ pages: [{ results: [RESULT], nextCursor: null, meta: { location: { source: 'gps' } } }] })

  async function elapseOfflineDelay() {
    await act(async () => {
      jest.advanceTimersByTime(OFFLINE_SIGNAL_DELAY_MS)
    })
  }

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(async () => {
    await act(async () => {
      onlineManager.setOnline(true)
    })
    jest.useRealTimers()
  })

  it('marks suggestions still on screen as the saved copy while offline, and clears it on reconnect', async () => {
    mockScope.value = { status: 'ready', source: 'gps', position: { lat: 10.77, lng: 106.7 } }
    mockSearch.value = { ...page({ source: 'gps' }), data: withResults() }
    onlineManager.setOnline(false)
    const view = await renderScreen(<HomeScreen />)
    await elapseOfflineDelay()
    expect(view.queryAllByText('Quán Gần Nhà').length).toBeGreaterThan(0)
    expect(view.getByText(OFFLINE)).toBeTruthy()

    await act(async () => {
      onlineManager.setOnline(true)
    })
    expect(view.queryByText(OFFLINE)).toBeNull()
  })

  it('claims no saved copy offline when there are no suggestions on screen', async () => {
    mockScope.value = { status: 'ready', source: 'gps', position: { lat: 10.77, lng: 106.7 } }
    mockSearch.value = page({ source: 'gps' })
    onlineManager.setOnline(false)
    const view = await renderScreen(<HomeScreen />)
    await elapseOfflineDelay()
    expect(view.queryByText(OFFLINE)).toBeNull()
  })

  it('shows the offline state instead of an endless skeleton when nothing is cached', async () => {
    mockScope.value = { status: 'ready', source: 'gps', position: { lat: 10.77, lng: 106.7 } }
    mockSearch.value = { data: undefined, isPending: true, isPaused: true, isError: false, error: null, refetch: jest.fn() }
    onlineManager.setOnline(false)
    const view = await renderScreen(<HomeScreen />)
    // A brief drop still reads as loading.
    expect(view.queryByText(NO_CONNECTION)).toBeNull()

    await elapseOfflineDelay()
    expect(view.getByText(NO_CONNECTION)).toBeTruthy()
    expect(view.getByText('Bạn đang ngoại tuyến. Một số thông tin có thể chưa cập nhật.')).toBeTruthy()
    // The search resumes by itself on reconnect; a retry here would do nothing.
    expect(view.queryByText('Thử lại')).toBeNull()
    expect(view.queryByText(OFFLINE)).toBeNull()

    await act(async () => {
      onlineManager.setOnline(true)
    })
    expect(view.queryByText(NO_CONNECTION)).toBeNull()
  })

  it('keeps the loading state for a paused search while online (the app was only in the background)', async () => {
    mockScope.value = { status: 'ready', source: 'gps', position: { lat: 10.77, lng: 106.7 } }
    mockSearch.value = { data: undefined, isPending: true, isPaused: true, isError: false, error: null, refetch: jest.fn() }
    const view = await renderScreen(<HomeScreen />)
    await elapseOfflineDelay()
    expect(view.queryByText(NO_CONNECTION)).toBeNull()
  })

  it('keeps suggestions on a failed refresh and says the refresh failed, with a retry', async () => {
    const refetch = jest.fn()
    mockScope.value = { status: 'ready', source: 'gps', position: { lat: 10.77, lng: 106.7 } }
    mockSearch.value = { data: withResults(), isPending: false, isError: true, error: new Error('500'), refetch }
    const view = await renderScreen(<HomeScreen />)
    expect(view.queryAllByText('Quán Gần Nhà').length).toBeGreaterThan(0)
    expect(view.getByText(FAILED)).toBeTruthy()
    expect(view.queryByText('Không tải được gợi ý.')).toBeNull()

    await press(view.getByText('Thử lại'))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('still shows the error card when nothing is cached and the search failed', async () => {
    mockScope.value = { status: 'ready', source: 'gps', position: { lat: 10.77, lng: 106.7 } }
    mockSearch.value = { data: undefined, isPending: false, isError: true, error: new Error('500'), refetch: jest.fn() }
    const view = await renderScreen(<HomeScreen />)
    expect(view.getByText('Không tải được gợi ý.')).toBeTruthy()
    expect(view.queryByText(FAILED)).toBeNull()
  })
})


it('offers a retry for a failed default-area lookup without running an unscoped search', async () => {
  mockScope.value = { status: 'unavailable', error: new Error('lookup failed'), offline: false }
  mockSearch.value = { data: undefined, isPending: true, isError: false, error: null, refetch: jest.fn() }
  const view = await renderScreen(<HomeScreen />)
  expect(mockSearchCalls.at(-1)?.options.enabled).toBe(false)
  await press(view.getByText('Thử lại'))
  expect(mockRetryScope).toHaveBeenCalledTimes(1)
})


it.each(['gps', 'administrative_area'])('shows the shared area independently of the search response source %s', async source => {
  useDiscoveryAreaStore.setState({ area: { ...AREA, provinceName: 'Thành phố Hà Nội', communeName: null } })
  mockScope.value = { status: 'ready', source: 'profile_area', area: AREA }
  mockSearch.value = page({ source, area: { ...AREA, provinceName: 'Thành phố Hà Nội', communeName: null } })
  const view = await renderScreen(<HomeScreen />)
  expect(view.getByText('Thành phố Hà Nội')).toBeTruthy()
  expect(view.queryByText(/Theo khu vực|Gần vị trí|Khu vực khám phá/)).toBeNull()
})

describe('Home pull to refresh', () => {
  it('refreshes suggestions, active room and badge together; waits through a partial failure', async () => {
    mockScope.value = { status: 'ready', source: 'gps', position: { lat: 10.77, lng: 106.7 } }
    let finish: (() => void) | undefined
    const refetch = jest.fn(() => new Promise<void>(resolve => { finish = resolve }))
    mockSearch.value = { ...page(undefined), refetch }
    mockRoomRefetch.mockRejectedValueOnce(new Error('room unavailable'))
    const view = await renderScreen(<HomeScreen />)
    const control = () => view.getByTestId('home-list').props.refreshControl
    expect(control().props.refreshing).toBe(false)
    const native = (RefreshControl as unknown as { latestRef: { props: import('react-native').RefreshControlProps } }).latestRef
    expect(native.props.tintColor).toBe('transparent')
    expect(native.props.colors).toEqual(['transparent'])
    await act(async () => { control().props.onRefresh(); control().props.onRefresh() })
    expect(refetch).toHaveBeenCalledTimes(1)
    expect(mockRoomRefetch).toHaveBeenCalledTimes(1)
    expect(mockInboxRefetch).toHaveBeenCalledTimes(1)
    expect(control().props.refreshing).toBe(true)
    expect(view.getByTestId('refresh-loading-indicator')).toBeTruthy()
    await act(async () => { finish!() })
    await waitFor(() => expect(control().props.refreshing).toBe(false))
    expect(view.queryByTestId('refresh-loading-indicator')).toBeNull()
    expect(view.getByTestId('home-suggestions')).toBeTruthy()
  })
  it('refreshes guest data without asking for notifications', async () => {
    mockSession.status = 'guest'
    mockScope.value = { status: 'ready', source: 'none', reason: 'no_area' }
    const view = await renderScreen(<HomeScreen />)
    await act(async () => { view.getByTestId('home-list').props.refreshControl.props.onRefresh() })
    expect(mockSearch.value.refetch).toHaveBeenCalledTimes(1)
    expect(mockRoomRefetch).toHaveBeenCalledTimes(1)
    expect(mockInboxRefetch).not.toHaveBeenCalled()
  })
  it('does not bypass an unresolved search scope on refresh', async () => {
    const view = await renderScreen(<HomeScreen />)
    await act(async () => { view.getByTestId('home-list').props.refreshControl.props.onRefresh() })
    expect(mockSearch.value.refetch).not.toHaveBeenCalled()
    expect(mockRoomRefetch).toHaveBeenCalledTimes(1)
    expect(view.getByTestId('home-list').props.refreshControl.props.refreshing).toBe(false)
  })
})
