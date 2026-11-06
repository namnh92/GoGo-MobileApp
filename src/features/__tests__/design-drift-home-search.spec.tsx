import type { DiscoveryScope } from '@/shared/location/use-discovery-scope'
import { StyleSheet } from 'react-native'
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query'
import i18n from '@/shared/i18n'
import { act, fireEvent, waitFor, within } from '@testing-library/react-native'

import { loaded as mockLoaded, renderScreen } from './harness'
import { scriptedTime } from './scripted-time'

/** Owner-approved group 02 discovery behaviour. */

const mockPush = jest.fn()
const mockBack = jest.fn()
const mockRetryScope = jest.fn()
const mockAddSeed = jest.fn()
let mockSessionStatus = 'user'
let mockRealSearch = false
let mockParams: Record<string, string> = {}
let mockScope: DiscoveryScope = { status: 'ready', source: 'gps', position: { lat: 21, lng: 105 } }
const mockQueries: Record<string, unknown>[] = []
const mockPreview = { value: {} as Record<string, unknown> }
const mockPreviewCalls: { query: Record<string, unknown>; enabled: boolean }[] = []
let mockKinds: Record<string, unknown> = {}
let mockUnread = { count: 0, more: false }
let mockHomeRoom: unknown = undefined
let mockCredits: unknown = undefined
const mockSearch: { value: Record<string, unknown> } = { value: {} }

let mockMapUnavailable = false
jest.mock('@/shared/ui/map-canvas.view', () => ({
  MapCanvas: ({ pins, onSelect, fallback, ...props }: { pins: { id: string; title: string }[]; onSelect: (id: string) => void; fallback: unknown }) => {
    if (mockMapUnavailable) return fallback
    const React = jest.requireActual('react')
    const { View, Text } = jest.requireActual('react-native')
    return React.createElement(View, { ...props, testID: 'discovery-native-map' }, pins.map(pin =>
      React.createElement(Text, { key: pin.id, accessibilityLabel: pin.title, onPress: () => onSelect(pin.id) }, pin.title)))
  },
}))

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => mockParams,
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: mockSessionStatus, session: null }),
}))
jest.mock('@/features/notifications/unread-count', () => ({ useUnreadInbox: () => mockUnread }))
jest.mock('@/features/create-date/draft-resume.view', () => ({ DraftResume: () => null }))
jest.mock('@/shared/location/use-current-location', () => ({
  useCurrentLocation: () => ({ state: { status: 'idle' }, request: jest.fn() }),
}))
jest.mock('@/shared/location/use-discovery-scope', () => ({
  ...jest.requireActual('@/shared/location/use-discovery-scope'),
  useDiscoveryScope: () => ({ scope: { ...mockScope }, recheck: jest.fn(), retry: mockRetryScope }),
}))
// Home and Search now open the real area picker inline; its dataset reads
// are independent of the discovery queries exercised by this suite.
jest.mock('@/shared/administrative/queries', () => ({
  ...jest.requireActual('@/shared/administrative/queries'),
  useAdministrativeVersion: () => mockLoaded({ datasetVersion: 'ds-2026' }),
  useAdministrativeUnits: () => mockLoaded([]),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useHomeRoom: () => mockLoaded(mockHomeRoom),
  useContributionCredits: () => mockLoaded(mockCredits),
  useDiscoveryPreview: (query: Record<string, unknown>, enabled: boolean) => { mockPreviewCalls.push({ query, enabled }); return mockRealSearch ? jest.requireActual('@/shared/api/queries/use-places').useDiscoveryPreview(query, enabled) : mockPreview.value },
  useJoinRoom: () => ({ mutateAsync: jest.fn() }),
  useMe: () => mockLoaded({ homeAdministrativeArea: null }),
  useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: jest.fn() }),
  useAddRoomSeedPlaces: () => ({ mutate: mockAddSeed }),
  useTaxonomies: () =>
    mockLoaded({ kinds: { category: [{ key: 'cafe', labels: { vi: 'Cà phê', en: 'Cafe' } }], ...mockKinds } }),
  usePlaceSearch: (query: Record<string, unknown>) => { mockQueries.push(query); return mockRealSearch ? jest.requireActual('@/shared/api/queries/use-places').usePlaceSearch(query) : mockSearch.value },
}))

import HomeScreen from '@/features/home/home.view'
import SearchScreen from '@/features/search/search.view'
import { useRoomStore } from '@/shared/store/roomStore'
import { useDiscoveryAreaStore } from '@/features/search/discovery-area-store'

function emptyPage() {
  return {
    data: { pages: [{ results: [], nextCursor: null, meta: {} }] },
    isSuccess: true,
    isFetchedAfterMount: true,
    isPending: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: jest.fn(),
  }
}

scriptedTime()

beforeEach(() => {
  mockUnread = { count: 0, more: false }
  mockRealSearch = false
  mockMapUnavailable = false
  mockSessionStatus = 'user'
  mockKinds = {}
  mockHomeRoom = undefined
  mockCredits = undefined
  mockPreview.value = {}
  mockPreviewCalls.length = 0
  mockPush.mockClear()
  mockBack.mockClear()
  mockRetryScope.mockClear()
  mockAddSeed.mockClear()
  mockQueries.length = 0
  mockParams = {}
  mockScope = { status: 'ready', source: 'gps', position: { lat: 21, lng: 105 } }
  useDiscoveryAreaStore.setState({ area: null })
  useRoomStore.getState().resetDraft()
  mockSearch.value = emptyPage()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('Home greeting (owner group 02)', () => {
  it('greets without inventing a missing name', async () => {
    const view = await renderScreen(<HomeScreen />)
    expect(view.getByText('Đi đâu hôm nay? 👋')).toBeTruthy()
  })
})

describe('group 02 discovery behaviour', () => {
  it('does not query draft filters until Apply; dismissal discards', async () => {
    const view = await renderScreen(<SearchScreen />)
    await fireEvent.press(view.getByLabelText('Bộ lọc'))
    await fireEvent.changeText(view.getByLabelText('Giá từ (nghìn đồng / người)'), '0')
    await fireEvent.changeText(view.getByLabelText('Giá đến (nghìn đồng / người)'), '200')
    expect(mockQueries.at(-1)?.priceMaxPerPerson).toBeUndefined()
    await fireEvent.press(view.getByText('Áp dụng bộ lọc'))
    expect(mockQueries.at(-1)).toMatchObject({ priceMinPerPerson: 0, priceMaxPerPerson: 200000 })
    await fireEvent.press(view.getByLabelText('Bộ lọc'))
    await fireEvent.changeText(view.getByLabelText('Giá đến (nghìn đồng / người)'), '100')
    await fireEvent.press(view.getByLabelText('Đóng'))
    expect(mockQueries.at(-1)?.priceMaxPerPerson).toBe(200000)
  })
  it('shows the designed zero-result state only after success, without speculative counts', async () => {
    const view = await renderScreen(<SearchScreen />)
    expect(view.getByText('Không tìm thấy địa điểm phù hợp')).toBeTruthy()
    expect(view.getByText('Tìm thấy 0 địa điểm')).toBeTruthy()
    expect(view.queryByText('Gợi ý nới lỏng bộ lọc')).toBeNull()
  })
})


it.each([{ isPending: true, isSuccess: false }, { isPaused: true }, { isFetching: true }, { isFetchedAfterMount: false }])('never presents stale, offline or unfinished empty responses as zero results (%j)', async state => {
  mockSearch.value = { ...emptyPage(), ...state }
  const view = await renderScreen(<SearchScreen />)
  expect(view.queryByText('Tìm thấy 0 địa điểm')).toBeNull()
  expect(view.queryByText('Không tìm thấy địa điểm phù hợp')).toBeNull()
})
it('ordinary search shares Home scope and never leaks the wizard origin', async () => {
  useRoomStore.setState({ originLat: 10, originLng: 106 })
  await renderScreen(<SearchScreen />)
  expect(mockQueries.at(-1)).toMatchObject({ lat: 21, lng: 105 })
})
it.each([false, true])('preserves wizard/existing-room picker callbacks (%s)', async existingRoom => {
  mockParams = { picker: '1', ...(existingRoom ? { roomId: 'room-1' } : {}) }
  useRoomStore.setState({ originLat: 10, originLng: 106 })
  mockSearch.value = { ...emptyPage(), data: { pages: [{ results: [{ id: 'place-1', name: 'Place', isLodging: false, lat: 10, lng: 106 }], meta: {} }] } }
  const view = await renderScreen(<SearchScreen />)
  expect(mockQueries.at(-1)).toMatchObject({ lat: 10, lng: 106 })
  expect(view.getByText(i18n.t('discovery.searchTitle'))).toBeTruthy()
  expect(view.queryByLabelText(i18n.t('home.chooseArea'))).toBeNull()
  await fireEvent.press(view.getByTestId('place-card-open-target'))
  if (existingRoom) expect(mockAddSeed).toHaveBeenCalledWith({ placeIds: ['place-1'] }, expect.objectContaining({ onSuccess: expect.any(Function) }))
  else { expect(useRoomStore.getState().seedPlaces).toContainEqual({ placeId: 'place-1', name: 'Place' }); expect(mockBack).toHaveBeenCalled() }
})
it('clear query debounces to an empty query and contribution opens the real import route', async () => {
  mockParams = { q: 'coffee' }
  const view = await renderScreen(<SearchScreen />)
  expect(mockQueries.at(-1)?.q).toBe('coffee')
  await fireEvent.press(view.getByRole('button', { name: 'Xóa nội dung' }))
  await act(async () => { await jest.advanceTimersByTimeAsync(300) })
  expect(mockQueries.at(-1)?.q).toBeUndefined()
  await fireEvent.press(view.getByRole('button', { name: 'Thêm địa điểm' }))
  expect(mockPush).toHaveBeenCalledWith('/places/import')
})


describe('#774 integration', () => {
  it('requests exact totals and renders supplied zero/positive counts only while current', async () => {
    mockSearch.value = { ...emptyPage(), data: { pages: [{ results: [], meta: { totalCount: 42, totalCountAccuracy: 'exact' } }] } }
    const view = await renderScreen(<SearchScreen />)
    expect(mockQueries.at(-1)?.includeTotal).toBe(true)
    expect(view.getByText('Tìm thấy 42 địa điểm')).toBeTruthy()
    await fireEvent.changeText(view.getByLabelText('Tìm địa điểm'), 'new')
    expect(view.queryByText('Tìm thấy 42 địa điểm')).toBeNull()
  })
  it('debounces draft preview with identical picker scope and query; never applies drafts', async () => {
    mockParams = { picker: '1', q: 'tea' }
    useRoomStore.setState({ originLat: 10, originLng: 106 })
    const view = await renderScreen(<SearchScreen />)
    await fireEvent.press(view.getByLabelText('Bộ lọc'))
    await fireEvent.changeText(view.getByLabelText('Giá đến (nghìn đồng / người)'), '100')
    expect(mockPreviewCalls.at(-1)?.enabled).toBe(false)
    await act(async () => { await jest.advanceTimersByTimeAsync(300) })
    expect(mockPreviewCalls.at(-1)).toMatchObject({ query: { lat: 10, lng: 106, q: 'tea', priceMaxPerPerson: 100000 }, enabled: true })
    expect(mockQueries.at(-1)?.priceMaxPerPerson).toBeUndefined()
    mockPreview.value = { isSuccess: true, data: { meta: { totalCount: 7 } } }
    await view.rerender(<SearchScreen />)
    expect(view.getByText('Xem 7 địa điểm')).toBeTruthy()
    await fireEvent.changeText(view.getByLabelText('Giá đến (nghìn đồng / người)'), '200')
    expect(view.queryByText('Xem 7 địa điểm')).toBeNull()
    await fireEvent.press(view.getByLabelText('Đóng'))
    expect(mockPreviewCalls.at(-1)?.enabled).toBe(false)
  })
  it('exposes only returned taxonomy groups and commits multi-value suitability', async () => {
    mockSearch.value = { ...emptyPage(), data: { pages: [{ results: [], meta: { totalCount: 0 } }] } }
    mockKinds = { amenity: [{ key: 'wifi', labels: { vi: 'Wi-Fi' } }], suitability: [{ key: 'family', labels: { vi: 'Gia đình' } }, { key: 'work_reading', labels: { vi: 'Làm việc' } }] }
    const view = await renderScreen(<SearchScreen />)
    await fireEvent.press(view.getByLabelText('Bộ lọc'))
    await fireEvent.press(view.getByText('Wi-Fi'))
    await fireEvent.press(view.getByText('Gia đình'))
    await fireEvent.press(view.getByText('Làm việc'))
    await fireEvent.press(view.getByText('Áp dụng bộ lọc'))
    expect(mockQueries.at(-1)).toMatchObject({ amenities: 'wifi', suitedFor: 'family,work_reading' })
  })
  it('filters Home immediately and carries moods to search', async () => {
    mockSearch.value = { ...emptyPage(), data: { pages: [{ results: [], meta: { totalCount: 0 } }] } }
    mockKinds = { mood: [{ key: 'cozy', labels: { vi: 'Ấm cúng' } }] }
    const view = await renderScreen(<HomeScreen />)
    await fireEvent.press(view.getByLabelText('Ấm cúng'))
    expect(mockQueries.at(-1)?.moods).toBe('cozy')
    await fireEvent.press(view.getByText('Xem thêm'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/places/search', params: { suggestions: '1', suggestionScope: JSON.stringify(mockScope), moods: 'cozy' } })
    await fireEvent.press(view.getByLabelText('Ấm cúng'))
    expect(mockQueries.at(-1)?.moods).toBeUndefined()
  })
  it('renders the server-selected Home room with a safe lobby fallback', async () => {
    mockHomeRoom = { items: [{ id: 'nearest', title: '  Đi chơi  ', type: 'group', participantCount: 4, status: 'active', startAt: null, endAt: null }] }
    const view = await renderScreen(<HomeScreen />)
    expect(view.getByText('Kèo hẹn đang diễn ra')).toBeTruthy()
    await fireEvent.press(view.getByText('Đi chơi'))
    expect(mockPush).toHaveBeenCalledWith('/room/nearest')
    mockHomeRoom = { items: [{ id: 'old', title: 'Old response', type: 'couple', participantCount: 2, status: 'active' }] }
    await view.rerender(<HomeScreen />)
    expect(view.getByText('Old response')).toBeTruthy()
  })
  it('shows the approval reward when credits are supported, including a zero balance', async () => {
    const view = await renderScreen(<SearchScreen />)
    expect(view.queryByText('+50 credit GoGo AI sau khi được duyệt')).toBeNull()
    mockCredits = { creditBalance: 0 }
    await view.rerender(<SearchScreen />)
    expect(view.getByText('+50 credit GoGo AI sau khi được duyệt')).toBeTruthy()
  })
})

const roomFacts = { id: 'nearest', status: 'ready', startAt: null, endAt: null }
it.each(['vi', 'en'])('keeps untitled couple/group banners with localized room facts (%s)', async locale => {
  await act(async () => { await i18n.changeLanguage(locale) })
  try {
    const view = await renderScreen(<HomeScreen />)
    for (const type of ['couple', 'group']) {
      for (const title of [undefined, '', '   ']) {
        mockHomeRoom = { items: [{ ...roomFacts, type, participantCount: type === 'group' ? 7 : 2, title }] }
        await view.rerender(<HomeScreen />)
        const expected = locale === 'vi' ? type === 'group' ? 'Kèo nhóm 7 người' : 'Kèo hẹn hò' : type === 'group' ? 'Group outing for 7 people' : 'Couple outing'
        expect(view.getByText(locale === 'vi' ? 'Đã chọn địa điểm' : 'Places selected')).toBeTruthy()
        await fireEvent.press(view.getByText(expected))
        expect(mockPush).toHaveBeenLastCalledWith('/room/nearest/match-result')
      }
    }
  } finally { await act(async () => { await i18n.changeLanguage('vi') }) }
})
it.each(['completed', 'cancelled', 'expired'])('omits an ineligible nearest room (%s)', async status => {
  mockHomeRoom = { items: [{ ...roomFacts, type: 'group', participantCount: 3, title: 'Excluded room', status }] }
  const view = await renderScreen(<HomeScreen />)
  expect(view.queryByText('Excluded room')).toBeNull()
})

it.each(['count only', 'all taxonomy', 'selected entry'])('keeps Home mood removal and See more after losing %s', async loss => {
  mockKinds = { mood: [{ key: 'cozy', labels: { vi: 'Ấm cúng' } }, { key: 'quiet', labels: { vi: 'Yên tĩnh' } }] }
  mockSearch.value = { ...emptyPage(), data: { pages: [{ results: [], meta: { totalCount: 2 } }] } }
  const view = await renderScreen(<HomeScreen />)
  await fireEvent.press(view.getByLabelText('Ấm cúng'))
  mockSearch.value = emptyPage()
  if (loss !== 'count only') mockKinds = loss === 'all taxonomy' ? {} : { mood: [{ key: 'quiet', labels: { vi: 'Yên tĩnh' } }] }
  await view.rerender(<HomeScreen />)
  const label = loss === 'count only' ? 'Ấm cúng' : 'Bỏ tâm trạng đã chọn 1'
  expect(view.getByLabelText(label).props.accessibilityState.selected).toBe(true)
  await fireEvent.press(view.getByText('Xem thêm'))
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/places/search', params: { suggestions: '1', suggestionScope: JSON.stringify(mockScope), moods: 'cozy' } })
  await fireEvent.press(view.getByLabelText(label))
  expect(mockQueries.at(-1)?.moods).toBeUndefined()
  // A selected chip remains removable after the taxonomy disappears.
  mockKinds = { mood: [{ key: 'cozy', labels: { vi: 'Ấm cúng' } }] }
  await view.rerender(<HomeScreen />)
  await fireEvent.press(view.getByLabelText('Ấm cúng'))
  mockKinds = {}
  await view.rerender(<HomeScreen />)
  await fireEvent.press(view.getByLabelText('Bỏ tâm trạng đã chọn 1'))
  expect(mockQueries.at(-1)?.moods).toBeUndefined()
})

it.each([true, false])('keeps a carried mood removable on an uncounted empty Search (taxonomy available=%s)', async available => {
  mockParams = { moods: 'cozy' }
  mockKinds = available ? { mood: [{ key: 'cozy', labels: { vi: 'Ấm cúng' } }] } : {}
  const view = await renderScreen(<SearchScreen />)
  expect(mockQueries.at(-1)?.moods).toBe('cozy')
  await fireEvent.press(view.getByLabelText('Bộ lọc'))
  await fireEvent.press(view.getByLabelText(available ? 'Ấm cúng' : 'Bỏ tâm trạng đã chọn 1'))
  await fireEvent.press(view.getByText('Áp dụng bộ lọc'))
  expect(mockQueries.at(-1)?.moods).toBeUndefined()
  // A fresh navigation carries the selection again; reset must clear it too.
  await view.unmount()
  const resetView = await renderScreen(<SearchScreen />)
  expect(mockQueries.at(-1)?.moods).toBe('cozy')
  await fireEvent.press(resetView.getByLabelText('Bộ lọc'))
  await fireEvent.press(resetView.getByLabelText('Đặt lại về mặc định'))
  await fireEvent.press(resetView.getByText('Áp dụng bộ lọc'))
  expect(mockQueries.at(-1)?.moods).toBeUndefined()
})

function httpResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body, text: async () => JSON.stringify(body) } as Response
}

it.each(['SEARCH_COUNT_UNAVAILABLE', 'RATE_LIMITED'])('typing and preview use real hooks through HTTP count failures (%s)', async code => {
  mockRealSearch = true
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  notifyManager.setScheduler(callback => callback())
  const page = { results: [{ id: 'place-1', name: 'Quán còn đây', isLodging: false }], nextCursor: null, meta: {} }
  const fetch = jest.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = new URL(String(input))
    const preview = url.searchParams.get('limit') === '1'
    const changed = url.searchParams.get('q') === 'tea' || url.searchParams.has('openAt')
    if (changed && url.searchParams.has('includeTotal')) return httpResponse({ code: preview ? code : 'SEARCH_COUNT_UNAVAILABLE', message: 'Count unavailable' }, 429)
    return httpResponse({ ...page, meta: url.searchParams.has('includeTotal') ? { totalCount: preview ? 7 : 42 } : {} })
  })
  const element = <QueryClientProvider client={client}><SearchScreen /></QueryClientProvider>
  try {
    const view = await renderScreen(element)
    await waitFor(() => expect(view.getByText('Tìm thấy 42 địa điểm')).toBeTruthy())
    await fireEvent.changeText(view.getByLabelText('Tìm địa điểm'), 'tea')
    expect(view.queryByText('Tìm thấy 42 địa điểm')).toBeNull()
    await act(async () => { await jest.advanceTimersByTimeAsync(300) })
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(view.getByText('Quán còn đây')).toBeTruthy()
    expect(view.queryByText('Tìm thấy 42 địa điểm')).toBeNull()
    expect(view.queryByText('Tìm thấy 0 địa điểm')).toBeNull()
    // Restore a current applied total before failing a previously successful preview.
    await fireEvent.changeText(view.getByLabelText('Tìm địa điểm'), '')
    await act(async () => { await jest.advanceTimersByTimeAsync(300) })
    await waitFor(() => expect(view.getByText('Tìm thấy 42 địa điểm')).toBeTruthy())
    await fireEvent.press(view.getByLabelText('Bộ lọc'))
    await act(async () => { await jest.advanceTimersByTimeAsync(300) })
    await waitFor(() => expect(view.getByText('Xem 7 địa điểm')).toBeTruthy())
    await fireEvent.press(view.getByLabelText('Mở cửa ngay'))
    expect(view.queryByText('Xem 7 địa điểm')).toBeNull()
    await act(async () => { await jest.advanceTimersByTimeAsync(300) })
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(view.queryByText('Xem 7 địa điểm')).toBeNull()
    expect(view.getByRole('button', { name: 'Áp dụng bộ lọc' }).props.accessibilityState.disabled).toBe(false)
    await fireEvent.press(view.getByLabelText('Đóng'))
    expect(view.getByText('Tìm thấy 42 địa điểm')).toBeTruthy()
    expect(view.getByTestId('search-results')).toBeTruthy()
    expect(view.getByText('Quán còn đây')).toBeTruthy()
    expect(view.queryByText('Có lỗi xảy ra')).toBeNull()
    const previewCalls = fetch.mock.calls.map(([input]) => new URL(String(input))).filter(url => url.searchParams.get('limit') === '1' && url.searchParams.has('openAt'))
    expect(previewCalls).toHaveLength(code === 'RATE_LIMITED' ? 1 : 2)
    expect(previewCalls.at(-1)?.searchParams.has('includeTotal')).toBe(code === 'RATE_LIMITED')
    await fireEvent.press(view.getByLabelText('Bộ lọc'))
    await fireEvent.press(view.getByLabelText('Mở cửa ngay'))
    await fireEvent.press(view.getByRole('button', { name: 'Áp dụng bộ lọc' }))
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(fetch.mock.calls.map(([input]) => new URL(String(input))).some(url => url.searchParams.get('limit') !== '1' && url.searchParams.get('openAt') === 'now')).toBe(true)
    expect(view.getByText('Quán còn đây')).toBeTruthy()
    expect(view.queryByText('Có lỗi xảy ra')).toBeNull()
    await view.unmount()
  } finally {
    client.clear()
    notifyManager.setScheduler(callback => setTimeout(callback, 0))
  }
})


describe('owner verification round 1 — O-1..O-3/O-5 entry', () => {
  it('keeps Open now in a content-sized chip row and toggles its selected state', async () => {
    const view = await renderScreen(<SearchScreen />)
    await fireEvent.press(view.getByLabelText('Bộ lọc'))
    expect(StyleSheet.flatten(view.getByTestId('amenity-status-options').props.style)).toMatchObject({ flexDirection: 'row' })
    const chip = view.getByLabelText('Mở cửa ngay')
    expect(chip.props.accessibilityState.selected).toBe(false)
    await fireEvent.press(chip)
    expect(view.getByLabelText('Mở cửa ngay').props.accessibilityState.selected).toBe(true)
  })

  it.each([['vi', 'Khoảng giá / người'], ['en', 'Price range / person']])('shows per-person scope once, two k suffixes, and sends integer VND in %s', async (locale, heading) => {
    await act(async () => { await i18n.changeLanguage(locale) })
    try {
      const view = await renderScreen(<SearchScreen />)
      await fireEvent.press(view.getByLabelText(i18n.t('search.filters')))
      expect(view.getAllByText(heading)).toHaveLength(1)
      expect(view.queryByText(i18n.t('discovery.priceUnit'))).toBeNull()
      expect(view.getAllByText('k')).toHaveLength(2)
      await fireEvent.changeText(view.getByLabelText(i18n.t('search.priceFromLabel')), '150')
      await fireEvent.changeText(view.getByLabelText(i18n.t('search.priceToLabel')), '250')
      await fireEvent.press(view.getByText(i18n.t('discovery.apply')))
      expect(mockQueries.at(-1)).toMatchObject({ priceMinPerPerson: 150000, priceMaxPerPerson: 250000 })
    } finally {
      await act(async () => { await i18n.changeLanguage('vi') })
    }
  })

  it('pushes account above search and opens the public location sheet', async () => {
    const view = await renderScreen(<SearchScreen />)
    await fireEvent.changeText(view.getByLabelText('Tìm địa điểm'), 'retained query')
    await fireEvent.press(view.getByLabelText(i18n.t('profile.title')))
    expect(mockPush).toHaveBeenCalledWith('/settings/account')
    expect(view.getByLabelText('Tìm địa điểm').props.value).toBe('retained query')
    await fireEvent.press(view.getByLabelText(i18n.t('home.chooseArea')))
    expect(view.getByTestId('discovery-location-sheet')).toBeTruthy()
  })
})


it('shows a recoverable lookup failure rather than an endless search skeleton', async () => {
  mockScope = { status: 'unavailable', error: new Error('province lookup failed'), offline: false }
  mockSearch.value = { ...emptyPage(), isPending: true }
  const view = await renderScreen(<SearchScreen />)
  await fireEvent.press(view.getByText('Thử lại'))
  expect(mockRetryScope).toHaveBeenCalledTimes(1)
})


it.each(['guest', 'anonymous'])('opens location without sign-in from search for %s', async status => {
  mockSessionStatus = status
  const view = await renderScreen(<SearchScreen />)
  await fireEvent.press(view.getByLabelText(i18n.t('home.chooseArea')))
  expect(view.getByTestId('discovery-location-sheet')).toBeTruthy()
  expect(mockPush).not.toHaveBeenCalledWith('/auth/sign-in')
})


const mapPlaces = [
  { id: 'top', name: 'Top place', isLodging: false, lat: 10, lng: 106 },
  { id: 'second', name: 'Second place', isLodging: false, lat: 21, lng: 105 },
]
function mapPages() {
  return { ...emptyPage(), data: { pages: mapPlaces.map(place => ({ results: [place], meta: {} })) } }
}

describe('owner verification round 2 — O-4 full-content map', () => {
  it.each(['vi', 'en'])('shows all loaded-page markers, no cards/caption, and opens a selected place in %s', async locale => {
    await act(async () => { await i18n.changeLanguage(locale) })
    try {
      mockSearch.value = mapPages()
      const view = await renderScreen(<SearchScreen />)
      await fireEvent.press(view.getByText(i18n.t('discovery.map')))
      expect(StyleSheet.flatten(view.getByTestId('search-map').props.style)).toMatchObject({ flex: 1 })
      const map = view.getByTestId('discovery-native-map')
      expect(StyleSheet.flatten(map.props.style)).toMatchObject({ flex: 1 })
      expect(map.props.cameraRegion).toMatchObject({ latitude: 21, longitude: 105 })
      expect(map.props.showsUserLocation).toBe(true)
      for (const place of mapPlaces) expect(view.getAllByLabelText(place.name)).toHaveLength(1)
      expect(view.queryByTestId('place-card-open-target')).toBeNull()
      expect(view.queryByTestId('search-results')).toBeNull()
      expect(view.queryByText('Bản đồ đánh dấu địa điểm đầu tiên trong danh sách.')).toBeNull()
      expect(view.queryByText('The map marks the first place in the list.')).toBeNull()
      await fireEvent.press(view.getByLabelText('Second place'))
      expect(view.getAllByText('Second place').length).toBeGreaterThan(0)
      await fireEvent.press(view.getByText(i18n.t('discovery.openPlace')))
      expect(mockPush).toHaveBeenLastCalledWith('/places/second')
      await fireEvent.press(view.getByText(i18n.t('discovery.list')))
      expect(view.getAllByTestId('place-card-open-target')).toHaveLength(2)
    } finally { await act(async () => { await i18n.changeLanguage('vi') }) }
  })

  it('updates markers and clears selection when search/filter results or area change', async () => {
    mockSearch.value = mapPages()
    const view = await renderScreen(<SearchScreen />)
    await fireEvent.press(view.getByText(i18n.t('discovery.map')))
    await fireEvent.press(view.getByLabelText('Top place'))
    mockScope = { status: 'ready', source: 'none', reason: 'no_area' }
    mockSearch.value = { ...emptyPage(), data: { pages: [{ results: [mapPlaces[1]], meta: {} }] } }
    await view.rerender(<SearchScreen />)
    expect(view.queryByLabelText('Top place')).toBeNull()
    expect(view.getByLabelText('Second place')).toBeTruthy()
    expect(view.queryByText(i18n.t('discovery.openPlace'))).toBeNull()
    expect(view.getByTestId('discovery-native-map').props.cameraRegion).toMatchObject({ latitude: 21, longitude: 105 })
    expect(view.getByTestId('discovery-native-map').props.showsUserLocation).toBe(false)
  })

  it('falls back to cards and working external directions only when the provider fails', async () => {
    mockSearch.value = mapPages()
    mockMapUnavailable = true
    const { Linking } = jest.requireActual('react-native')
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
    const view = await renderScreen(<SearchScreen />)
    await fireEvent.press(view.getByText(i18n.t('discovery.map')))
    expect(view.getAllByTestId('place-card-open-target')).toHaveLength(2)
    expect(view.getByText(i18n.t('discovery.mapFallback'))).toBeTruthy()
    await fireEvent.press(view.getAllByText(i18n.t('common.directions'))[1])
    expect(openURL).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=21%2C105')
    await fireEvent.press(view.getAllByTestId('place-card-open-target')[1])
    expect(mockPush).toHaveBeenLastCalledWith('/places/second')
  })

  it('keeps the existing verified-empty state instead of mounting a GPS-only map', async () => {
    const view = await renderScreen(<SearchScreen />)
    await fireEvent.press(view.getByText(i18n.t('discovery.map')))
    expect(view.getByText(i18n.t('discovery.emptyTitle'))).toBeTruthy()
    expect(view.queryByTestId('discovery-native-map')).toBeNull()
  })

  it.each([{ isPending: true, isSuccess: false }, { isPaused: true }, { isError: true, error: new Error('failed') }])('keeps loading/offline/error states out of the map (%j)', async state => {
    mockSearch.value = { ...emptyPage(), ...state }
    const view = await renderScreen(<SearchScreen />)
    await fireEvent.press(view.getByText(i18n.t('discovery.map')))
    expect(view.queryByTestId('discovery-native-map')).toBeNull()
    expect(view.queryByText(i18n.t('discovery.emptyTitle'))).toBeNull()
  })
})


describe('#515 owner round 2 — Home notifications and suggestions', () => {
  it.each([0, 3])('has one header notification entry, no avatar, and preserves unread behaviour (%s)', async count => {
    mockUnread = { count, more: false }
    const view = await renderScreen(<HomeScreen />)
    const bell = within(view.getByTestId('home-header')).getByTestId('home-bell')
    expect(view.getAllByTestId('home-bell')).toHaveLength(1)
    const label = count ? i18n.t('home.bellUnread', { count: String(count) }) : i18n.t('notifications.title')
    expect(view.getAllByRole('button', { name: label })).toHaveLength(1)
    expect(view.queryByRole('button', { name: i18n.t('profile.title') })).toBeNull()
    const target = StyleSheet.flatten(bell.props.style)
    expect(target.width).toBeGreaterThanOrEqual(44)
    expect(target.height).toBeGreaterThanOrEqual(44)
    expect(view.queryByTestId('home-unread-dot') !== null).toBe(count > 0)
    await fireEvent.press(bell)
    expect(mockPush).toHaveBeenCalledWith('/notifications')
  })

  it('renders only the first five suggestions with no Home pagination', async () => {
    const places = Array.from({ length: 7 }, (_, index) => ({ id: `place-${index}`, name: `Place ${index}`, isLodging: false }))
    mockSearch.value = { ...emptyPage(), hasNextPage: true, data: { pages: [{ results: places, nextCursor: 'next' }, { results: [{ id: 'extra', name: 'Extra page', isLodging: false }] }] } }
    const view = await renderScreen(<HomeScreen />)
    expect(mockQueries.at(-1)).toMatchObject({ limit: 5, lat: 21, lng: 105 })
    expect(mockQueries.at(-1)?.sort).toBeUndefined()
    expect(view.getAllByTestId('place-card-open-target')).toHaveLength(5)
    expect(view.queryByText('Place 5')).toBeNull()
    expect(view.queryByText('Extra page')).toBeNull()
    await fireEvent.scroll(view.getByTestId('home-list'), { nativeEvent: { contentOffset: { y: 2000 }, contentSize: { height: 2200 }, layoutMeasurement: { height: 800 } } })
    expect(mockSearch.value.fetchNextPage).not.toHaveBeenCalled()
  })

  it('requests five on Home, then ten per cursor page from Xem thêm, stopping at null', async () => {
    mockRealSearch = true
    mockKinds = { mood: [{ key: 'cozy', labels: { vi: 'Ấm cúng' } }] }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    notifyManager.setScheduler(callback => callback())
    let failNextPage = true
    const fetch = jest.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = new URL(String(input))
      if (url.searchParams.has('cursor') && failNextPage) {
        failNextPage = false
        return httpResponse({ code: 'INTERNAL_ERROR', message: 'Page failed' }, 500)
      }
      const limit = Number(url.searchParams.get('limit'))
      const offset = url.searchParams.has('cursor') ? 10 : 0
      return httpResponse({ results: Array.from({ length: limit }, (_, index) => ({ id: `place-${offset + index}`, name: `Place ${offset + index}`, isLodging: false })), nextCursor: offset ? null : 'page-2', meta: {} })
    })
    try {
      const home = await renderScreen(<QueryClientProvider client={client}><HomeScreen /></QueryClientProvider>)
      await waitFor(() => expect(home.getAllByTestId('place-card-open-target')).toHaveLength(5))
      await fireEvent.press(home.getByLabelText('Ấm cúng'))
      await waitFor(() => expect(client.isFetching()).toBe(0))
      await fireEvent.press(home.getByText('Xem thêm'))
      mockParams = mockPush.mock.calls.at(-1)?.[0].params
      expect(mockParams).toMatchObject({ suggestions: '1', moods: 'cozy', suggestionScope: JSON.stringify(mockScope) })
      await home.unmount()
      // Discovery now resolves somewhere else; the Home entry must retain its scope.
      mockScope = { status: 'ready', source: 'gps', position: { lat: 10, lng: 106 } }
      const list = await renderScreen(<QueryClientProvider client={client}><SearchScreen /></QueryClientProvider>)
      await waitFor(() => expect(list.getByText('Place 0')).toBeTruthy())
      const urls = () => fetch.mock.calls.map(([input]) => new URL(String(input)))
      expect(urls().filter(url => url.searchParams.get('limit') === '5').length).toBeGreaterThan(0)
      const first = urls().find(url => url.searchParams.get('limit') === '10')!
      expect(first.searchParams.get('lat')).toBe('21')
      expect(first.searchParams.get('lng')).toBe('105')
      expect(first.searchParams.get('moods')).toBe('cozy')
      expect(first.searchParams.has('sort')).toBe(false)
      await fireEvent(list.getByTestId('search-results'), 'onEndReached')
      await waitFor(() => expect(list.getByRole('button', { name: i18n.t('common.retry') })).toBeTruthy())
      expect(list.getByTestId('search-results').props.data).toHaveLength(10)
      await fireEvent.press(list.getByRole('button', { name: i18n.t('common.retry') }))
      await waitFor(() => expect(list.getByTestId('search-results').props.data).toHaveLength(20))
      const pages = urls().filter(url => url.searchParams.get('limit') === '10')
      expect(pages).toHaveLength(3)
      expect(pages.slice(1).map(url => url.searchParams.get('cursor'))).toEqual(['page-2', 'page-2'])
      expect(pages[1].searchParams.get('moods')).toBe('cozy')
      expect(pages[1].searchParams.get('lat')).toBe('21')
      expect(pages[1].searchParams.has('includeTotal')).toBe(false)
      const count = fetch.mock.calls.length
      await fireEvent(list.getByTestId('search-results'), 'onEndReached')
      expect(fetch).toHaveBeenCalledTimes(count)
      await list.unmount()
    } finally {
      client.clear()
      notifyManager.setScheduler(callback => setTimeout(callback, 0))
    }
  })

  it('preserves the Home administrative scope until the user explicitly chooses another area', async () => {
    const area = { datasetVersion: 'v1', provinceCode: 'home-province', provinceName: 'Home province', communeCode: 'home-commune', communeName: 'Home commune' }
    const previousArea = { ...area, provinceCode: 'previous-province' }
    useDiscoveryAreaStore.setState({ area: previousArea })
    mockParams = { suggestions: '1', suggestionScope: JSON.stringify({ status: 'ready', source: 'default_area', area }) }
    await renderScreen(<SearchScreen />)
    expect(mockQueries.at(-1)).toMatchObject({ limit: 10, datasetVersion: 'v1', provinceCode: 'home-province', communeCode: 'home-commune' })
    expect(mockQueries.at(-1)?.lat).toBeUndefined()
    mockScope = { status: 'ready', source: 'selected_area', area: previousArea }
    await act(async () => { useDiscoveryAreaStore.setState({ area: { ...previousArea } }) })
    expect(mockQueries.at(-1)?.provinceCode).toBe('previous-province')
  })

  it('keeps cards and exposes a retry footer after a next-page failure', async () => {
    mockParams = { suggestions: '1', suggestionScope: JSON.stringify(mockScope) }
    const fetchNextPage = jest.fn()
    mockSearch.value = { ...emptyPage(), isError: true, isSuccess: false, isFetchNextPageError: true, hasNextPage: true, error: new Error('Page failed'), fetchNextPage, data: { pages: [{ results: [{ id: 'kept', name: 'Kept place', isLodging: false }], nextCursor: 'page-2' }] } }
    const view = await renderScreen(<SearchScreen />)
    expect(view.getByText('Kept place')).toBeTruthy()
    await fireEvent(view.getByTestId('search-results'), 'onEndReached')
    expect(fetchNextPage).not.toHaveBeenCalled()
    await fireEvent.press(view.getByRole('button', { name: i18n.t('common.retry') }))
    expect(fetchNextPage).toHaveBeenCalledTimes(1)
  })

  it('shows a loading footer and blocks duplicate requests while fetching', async () => {
    mockParams = { suggestions: '1' }
    mockSearch.value = { ...emptyPage(), hasNextPage: true, isFetching: true, isFetchingNextPage: true }
    const view = await renderScreen(<SearchScreen />)
    expect(view.getByTestId('search-loading-more')).toBeTruthy()
    await fireEvent(view.getByTestId('search-results'), 'onEndReached')
    expect(mockSearch.value.fetchNextPage).not.toHaveBeenCalled()
  })
})


describe('#515 refreshed Stitch Home', () => {
  it('places the horizontal mood filters in the single suggestions section, with no mood section or footer note', async () => {
    mockKinds = { mood: [{ key: 'cozy', labels: { vi: 'Ấm cúng' } }] }
    const view = await renderScreen(<HomeScreen />)
    const section = within(view.getByTestId('home-suggestions'))
    expect(view.getAllByText('Gợi ý dành cho bạn')).toHaveLength(1)
    expect(section.getByText('Xem thêm')).toBeTruthy()
    expect(section.getByTestId('home-mood-chips').props.horizontal).toBe(true)
    expect(view.queryByText('Khám phá theo tâm trạng')).toBeNull()
    expect(view.queryByText('Gợi ý thịnh hành')).toBeNull()
    expect(view.queryByText('Tất cả')).toBeNull()
    expect(view.queryByText(/thời gian thực|real.time/i)).toBeNull()
    const chip = section.getByLabelText('Ấm cúng')
    expect(chip.props.accessibilityState.selected).toBe(false)
    await fireEvent.press(chip)
    expect(mockQueries.at(-1)?.moods).toBe('cozy')
    expect(section.getByText('✓ Ấm cúng')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
    await fireEvent.press(section.getByLabelText('Ấm cúng'))
    expect(mockQueries.at(-1)?.moods).toBeUndefined()
  })

  it('renders API card facts through the shared discovery card and omits missing facts', async () => {
    mockKinds = { mood: [{ key: 'cozy', labels: { vi: 'Ấm cúng' } }] }
    mockSearch.value = { ...emptyPage(), data: { pages: [{ results: [{
      id: 'venue', name: 'Địa điểm từ API', isLodging: false,
      addressText: '12 Nguyễn Huệ', areaSummary: { label: 'Quận 1' }, distanceM: 2100,
      verification: { status: 'verified' }, taxonomies: [{ kind: 'mood', key: 'cozy' }],
      rating: 4.6, ratingCount: 980, gogoRating: 4.9, gogoRatingCount: 20,
      pricePerPerson: { min: 45000, max: 90000, currency: 'VND', confidence: 1 },
      open: { openNow: true, closesAtMinute: 1200 },
    }, { id: 'sparse', name: 'Chỉ có tên', isLodging: false }], meta: {} }] } }
    const view = await renderScreen(<HomeScreen />)
    const [full, sparse] = view.getAllByTestId('place-card-discovery').map(card => within(card))
    expect(full.getByText('Xác minh')).toBeTruthy()
    expect(full.getByText('2,1 km • Quận 1')).toBeTruthy()
    expect(full.getByText('● Mở đến 20:00')).toBeTruthy()
    expect(full.getByText('45k–90k/người')).toBeTruthy()
    expect(full.getByText('12 Nguyễn Huệ').props.numberOfLines).toBe(2)
    expect(full.getByText('Địa điểm từ API').props.numberOfLines).toBe(1)
    expect(full.getByText('★ 4,6 (980) Google')).toBeTruthy()
    expect(full.getByText('★ 4,9 (20) GoGo')).toBeTruthy()
    expect(full.getByText('Ấm cúng')).toBeTruthy()
    expect(sparse.queryByText('Chưa có thông tin giá')).toBeNull()
    expect(sparse.queryByTestId('place-card-photo-badges')).toBeNull()
    expect(sparse.queryByTestId('place-card-meta')).toBeNull()
    expect(sparse.queryByText(/Google|GoGo|Xác minh/)).toBeNull()
  })
})


describe('owner verification round 3', () => {
  it.each(['user', 'guest', 'anonymous'])('opens and closes the Home area sheet for %s', async status => {
    mockSessionStatus = status
    const view = await renderScreen(<HomeScreen />)
    await fireEvent.press(view.getByTestId('home-location'))
    expect(view.getByTestId('discovery-location-sheet')).toBeTruthy()
    await fireEvent.press(view.getAllByLabelText(i18n.t('common.close')).at(-1)!)
    expect(view.queryByTestId('discovery-location-sheet')).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('keeps amenity/status chips in one wrapping group and wraps all price presets', async () => {
    mockKinds = { amenity: [{ key: 'wifi', labels: { vi: 'Wi-Fi' } }, { key: 'parking', labels: { vi: 'Đậu xe' } }] }
    const view = await renderScreen(<SearchScreen />)
    await fireEvent.press(view.getByLabelText(i18n.t('search.filters')))
    const group = view.getByTestId('amenity-status-options')
    expect(within(group).getAllByRole('button').map(chip => chip.props.accessibilityLabel)).toEqual(['Mở cửa ngay', 'Wi-Fi', 'Đậu xe'])
    expect(StyleSheet.flatten(group.props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap', gap: 8 })
    const presets = view.getByTestId('price-presets')
    expect(within(presets).getAllByRole('button')).toHaveLength(3)
    expect(StyleSheet.flatten(presets.props.style)).toMatchObject({ flexWrap: 'wrap', gap: 8 })
    expect(view.getByLabelText(i18n.t('search.priceFromLabel')).props.placeholder).toBeUndefined()
    expect(view.getByLabelText(i18n.t('search.priceToLabel')).props.placeholder).toBeUndefined()
  })

  it('shows a selected mood with a leading check and the Stitch chip surface', async () => {
    mockKinds = { mood: [{ key: 'cozy', labels: { vi: 'Ấm cúng' } }] }
    const view = await renderScreen(<HomeScreen />)
    const chip = () => view.getByLabelText('Ấm cúng')
    const surface = () => StyleSheet.flatten(chip().queryAll(node => node.type === 'View' && StyleSheet.flatten(node.props.style)?.height === 36)[0].props.style)
    expect(chip().props.accessibilityState.selected).toBe(false)
    expect(surface()).toMatchObject({ height: 36, paddingHorizontal: 14, backgroundColor: '#FFFFFF' })
    expect(chip().props.hitSlop.top + surface().height + chip().props.hitSlop.bottom).toBeGreaterThanOrEqual(44)
    await fireEvent.press(chip())
    expect(chip().props.accessibilityState.selected).toBe(true)
    expect(view.getByText('✓ Ấm cúng')).toBeTruthy()
    expect(surface()).toMatchObject({ backgroundColor: '#FFE3DA' })
  })

  it('renders See more as a plain link with a 44pt target', async () => {
    const view = await renderScreen(<HomeScreen />)
    const more = view.getByLabelText(i18n.t('discovery.more'))
    expect(StyleSheet.flatten(more.props.style)).toMatchObject({ minHeight: 44, alignItems: 'center' })
    expect(StyleSheet.flatten(more.props.style).backgroundColor).toBeUndefined()
    await fireEvent.press(more)
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/places/search' }))
  })

  it.each(['vi', 'en'])('shows the approval reward without a credit conversion explanation (%s)', async locale => {
    await act(async () => { await i18n.changeLanguage(locale) })
    try {
      mockCredits = { creditBalance: 0 }
      const view = await renderScreen(<SearchScreen />)
      expect(view.getByText(locale === 'vi' ? '+50 credit GoGo AI sau khi được duyệt' : '+50 GoGo AI credits after approval')).toBeTruthy()
      expect(view.queryByText(/1 (tin nhắn|message) = 1 credit/)).toBeNull()
    } finally { await act(async () => { await i18n.changeLanguage('vi') }) }
  })
})


it('lets an explicit location-sheet apply replace the carried Home scope even when no area was stored', async () => {
  mockParams = { suggestions: '1', suggestionScope: JSON.stringify({ status: 'ready', source: 'gps', position: { lat: 10, lng: 106 } }) }
  mockScope = { status: 'ready', source: 'gps', position: { lat: 21, lng: 105 } }
  const view = await renderScreen(<SearchScreen />)
  expect(mockQueries.at(-1)).toMatchObject({ lat: 10, lng: 106 })
  await fireEvent.press(view.getByLabelText(i18n.t('home.chooseArea')))
  await fireEvent.press(view.getByText(i18n.t('discovery.useArea')))
  expect(view.queryByTestId('discovery-location-sheet')).toBeNull()
  expect(mockQueries.at(-1)).toMatchObject({ lat: 21, lng: 105 })
})
