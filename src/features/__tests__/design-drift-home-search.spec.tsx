import type { DiscoveryScope } from '@/shared/location/use-discovery-scope'
import { StyleSheet } from 'react-native'
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query'
import i18n from '@/shared/i18n'
import { act, fireEvent, waitFor, within } from '@testing-library/react-native'
import { Gesture, State } from 'react-native-gesture-handler'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'
import { StyleSheet as UnistylesStyleSheet } from 'react-native-unistyles'
import { themes } from '@/shared/ui/theme'

import { loaded as mockLoaded, renderScreen } from './harness'
import { scriptedTime } from './scripted-time'

/** Owner-approved group 02 discovery behaviour. */

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockRetryScope = jest.fn()
const mockAddSeed = jest.fn()
const mockToggleSaved = jest.fn()
let mockSessionStatus = 'user'
let mockRealSearch = false
let mockRegionSearch: Record<string, unknown> | null = null
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
const mockNearby: { value: Record<string, unknown> } = { value: {} }
let mockPreviewFor: ((query: Record<string, unknown>) => Record<string, unknown>) | undefined

let mockMapUnavailable = false
jest.mock('@/shared/ui/map-canvas.view', () => ({
  MapCanvas: ({ pins, onSelect, fallback, ...props }: { pins: { id: string; title: string }[]; onSelect: (id: string) => void; fallback: unknown }) => {
    if (mockMapUnavailable) return fallback
    const React = jest.requireActual('react')
    const { View, Text } = jest.requireActual('react-native')
    return React.createElement(View, { ...props, pins, testID: 'discovery-native-map' }, pins.map(pin =>
      React.createElement(Text, { key: pin.id, accessibilityLabel: pin.title, onPress: () => onSelect(pin.id) }, pin.title)))
  },
}))

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: mockSessionStatus, session: null }),
}))
jest.mock('@/features/notifications/unread-count', () => ({ useUnreadInbox: () => mockUnread }))
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
  useDiscoveryPreview: (query: Record<string, unknown>, enabled: boolean) => { mockPreviewCalls.push({ query, enabled }); return mockRealSearch ? jest.requireActual('@/shared/api/queries/use-places').useDiscoveryPreview(query, enabled) : mockPreviewFor?.(query) ?? mockPreview.value },
  useJoinRoom: () => ({ mutateAsync: jest.fn() }),
  useMe: () => mockLoaded({ homeAdministrativeArea: null }),
  useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: mockToggleSaved }),
  useAddRoomSeedPlaces: () => ({ mutate: mockAddSeed }),
  useTaxonomies: () =>
    mockLoaded({ kinds: { category: [{ key: 'cafe', labels: { vi: 'Cà phê', en: 'Cafe' } }], ...mockKinds } }),
  usePlaceSearch: (query: Record<string, unknown>, options?: { enabled?: boolean }) => { if (query.limit !== 2) mockQueries.push(query); return mockRealSearch ? jest.requireActual('@/shared/api/queries/use-places').usePlaceSearch(query, options) : query.limit === 2 ? mockNearby.value : query.radiusM && mockRegionSearch ? mockRegionSearch : mockSearch.value },
}))

import HomeScreen from '@/features/home/home.view'
import SearchScreen from '@/features/search/search.view'
import { useRoomStore } from '@/shared/store/roomStore'
import { useDiscoveryAreaStore } from '@/features/search/discovery-area-store'
import { createQueryClient } from '@/shared/api/query-client'
import { NetworkError } from '@/shared/api/errors'
import { accents, surface, type } from '@/shared/ui/tokens'

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
  mockRegionSearch = null
  mockMapUnavailable = false
  mockSessionStatus = 'user'
  mockKinds = {}
  mockHomeRoom = undefined
  mockCredits = undefined
  mockPreview.value = {}
  mockPreviewFor = undefined
  mockNearby.value = emptyPage()
  mockPreviewCalls.length = 0
  mockPush.mockClear()
  mockReplace.mockClear()
  mockToggleSaved.mockClear()
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
  it('shares empty-result CTA geometry, typography and icon sizing with one dominant primary', async () => {
    const view = await renderScreen(<SearchScreen />)
    const reset = view.getByRole('button', { name: i18n.t('discovery.resetSearch') })
    const ai = view.getByRole('button', { name: i18n.t('discovery.askAI') })
    for (const [button, label] of [[reset, 'discovery.resetSearch'], [ai, 'discovery.askAI']] as const) {
      expect(StyleSheet.flatten(button.props.style)).toMatchObject({
        minHeight: 48, borderRadius: 999,
        paddingVertical: 12, paddingHorizontal: 16, gap: 4, borderWidth: 1,
      })
      expect(StyleSheet.flatten(view.getByText(i18n.t(label)).props.style)).toMatchObject(type.buttonLabel)
      const icon = button.children[0]
      if (typeof icon === 'string') throw new Error('Expected the shared Material icon')
      expect(icon.props).toMatchObject({ bbWidth: 20, bbHeight: 20 })
    }
    expect(StyleSheet.flatten(reset.props.style).backgroundColor).toBe(accents.orange.primary)
    expect(StyleSheet.flatten(ai.props.style)).toMatchObject({ backgroundColor: surface.card, borderColor: accents.orange.primary })
    await fireEvent.press(ai)
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/assistant' })
  })
})


it.each([{ isPending: true, isSuccess: false }, { isPaused: true }, { isFetching: true }, { isFetchedAfterMount: false, isStale: true }])('never presents stale, offline or unfinished empty responses as zero results (%j)', async state => {
  mockSearch.value = { ...emptyPage(), ...state }
  const view = await renderScreen(<SearchScreen />)
  expect(view.queryByText('Tìm thấy 0 địa điểm')).toBeNull()
  expect(view.queryByText('Không tìm thấy địa điểm phù hợp')).toBeNull()
  expect(view.queryByRole('button', { name: i18n.t('discovery.addPlace') })).toBeNull()
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
  expect(mockQueries.at(-1)).toMatchObject({ lat: 21, lng: 105 })
  expect(view.getByText(i18n.t('discovery.searchTitle'))).toBeTruthy()
  expect(view.queryByLabelText(i18n.t('home.chooseArea'))).toBeNull()
  await fireEvent.press(view.getByTestId('place-card-open-target'))
  if (existingRoom) expect(mockAddSeed).toHaveBeenCalledWith({ placeIds: ['place-1'] }, expect.objectContaining({ onSuccess: expect.any(Function) }))
  else { expect(useRoomStore.getState().seedPlaces).toContainEqual({ placeId: 'place-1', name: 'Place' }); expect(mockBack).toHaveBeenCalled() }
})
it.each(['list', 'map'])('hides contribution on non-empty Search results (%s)', async mode => {
  mockCredits = { creditBalance: 0 }
  mockSearch.value = { ...emptyPage(), data: { pages: [{ results: [{ id: 'known', name: 'Known place', isLodging: false }] }] } }
  const view = await renderScreen(<SearchScreen />)
  if (mode === 'map') await fireEvent.press(view.getByRole('tab', { name: i18n.t('discovery.map') }))
  expect(view.queryByText(i18n.t('discovery.contributeTitle'))).toBeNull()
  expect(view.queryByRole('button', { name: i18n.t('discovery.addPlace') })).toBeNull()
  expect(view.queryByText(i18n.t('discovery.approvalReward'))).toBeNull()
})

it('clear query debounces to an empty query and contribution opens the real import route', async () => {
  mockParams = { q: 'coffee' }
  const view = await renderScreen(<SearchScreen />)
  expect(mockQueries.at(-1)?.q).toBe('coffee')
  await fireEvent.press(view.getByRole('button', { name: 'Xóa nội dung' }))
  await act(async () => { await jest.advanceTimersByTimeAsync(300) })
  expect(mockQueries.at(-1)?.q).toBeUndefined()
  await fireEvent.press(view.getByRole('button', { name: 'Thêm địa điểm mới' }))
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
    expect(mockPreviewCalls.at(-1)).toMatchObject({ query: { lat: 21, lng: 105, q: 'tea', priceMaxPerPerson: 100000 }, enabled: true })
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
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/places/search', params: { suggestions: '1', moods: 'cozy' } })
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
describe('#515 Stitch search row and empty recovery', () => {
  it('keeps the count and intrinsic-width tabs on one row and highlights only the number', async () => {
    const view = await renderScreen(<SearchScreen />)
    const row = StyleSheet.flatten(view.getByTestId('search-summary-row').props.style)
    expect(row.flexDirection).toBe('row')
    expect(row.flexWrap).toBeUndefined()
    expect(StyleSheet.flatten(view.getByText('0').props.style).color).toBe(themes.orange.accent.primaryDeep)
    expect(view.getByText('Tìm thấy 0 địa điểm')).toBeTruthy()
    expect(view.getByTestId('search-filter-off-badge')).toBeTruthy()
    expect(view.getByText(i18n.t('discovery.contributeTitle'))).toBeTruthy()
    expect(view.getByText(i18n.t('discovery.addPlace'))).toBeTruthy()
  })

  it('previews only current criteria, hides unknown/zero counts, and applies a real budget relaxation', async () => {
    mockParams = { q: 'tea', moods: 'cozy' }
    const view = await renderScreen(<SearchScreen />)
    await fireEvent.press(view.getByLabelText('Bộ lọc'))
    await fireEvent.changeText(view.getByLabelText('Giá đến (nghìn đồng / người)'), '100')
    await fireEvent.press(view.getByLabelText('Mở cửa ngay'))
    mockPreviewFor = query => ({ isSuccess: true, isFetchedAfterMount: true, data: { meta: { totalCount: query.priceMaxPerPerson === 150000 ? 7 : query.openAt ? undefined : 0 } } })
    await fireEvent.press(view.getByText('Áp dụng bộ lọc'))
    const block = within(view.getByTestId('search-relaxations'))
    expect(block.getByText('+7 quán phù hợp')).toBeTruthy()
    expect(block.queryByText(/Bỏ tiêu chí/)).toBeNull()
    const previews = mockPreviewCalls.filter(call => call.enabled).slice(-3)
    expect(previews).toHaveLength(3)
    expect(previews.map(call => call.query)).toEqual([
      expect.objectContaining({ lat: 21, lng: 105, q: 'tea', priceMaxPerPerson: 150000, openAt: 'now', moods: 'cozy' }),
      expect.objectContaining({ lat: 21, lng: 105, q: 'tea', priceMaxPerPerson: 100000, moods: 'cozy' }),
      expect.objectContaining({ lat: 21, lng: 105, q: 'tea', priceMaxPerPerson: 100000, openAt: 'now' }),
    ])
    expect(previews[1].query.openAt).toBeUndefined()
    expect(previews[2].query.moods).toBeUndefined()
    await fireEvent.press(block.getByRole('button', { name: 'Áp dụng: Tăng ngân sách lên ~150k/người' }))
    expect(mockQueries.at(-1)).toMatchObject({ q: 'tea', priceMaxPerPerson: 150000, openAt: 'now', moods: 'cozy', lat: 21, lng: 105 })
  })

  it.each([
    { isSuccess: false, isError: true }, { isSuccess: true, isFetching: true },
    { isSuccess: true, isPaused: true }, { isSuccess: true, isPlaceholderData: true },
    { isSuccess: true, isFetchedAfterMount: false, isStale: true },
  ])('does not offer unavailable or stale relaxation counts (%j)', async state => {
    mockParams = { moods: 'cozy' }
    mockPreview.value = { isFetchedAfterMount: true, data: { meta: { totalCount: 9 } }, ...state }
    const view = await renderScreen(<SearchScreen />)
    expect(view.queryByTestId('search-relaxations')).toBeNull()
  })

  it('drops the whole OR group and preserves keyword and scope', async () => {
    mockParams = { moods: 'cozy,quiet', q: 'tea' }
    mockPreview.value = { isSuccess: true, isFetchedAfterMount: true, data: { meta: { totalCount: 4 } } }
    const view = await renderScreen(<SearchScreen />)
    await fireEvent.press(view.getByRole('button', { name: /Bỏ chọn: Bỏ tiêu chí/ }))
    expect(mockQueries.at(-1)).toMatchObject({ lat: 21, lng: 105, q: 'tea' })
    expect(mockQueries.at(-1)?.moods).toBeUndefined()
    expect(view.queryByTestId('search-relaxations')).toBeNull()
  })

  it('shows compact real nearby rows, omits unknown facts, and opens the place or unrestricted list', async () => {
    mockParams = { moods: 'cozy', q: 'tea' }
    mockNearby.value = { ...emptyPage(), data: { pages: [{ results: [
      { id: 'near', name: 'Nearby cafe', isLodging: false, distanceM: 800, verification: { status: 'verified' } },
      { id: 'other', name: 'Other cafe', isLodging: false },
      { id: 'hidden', name: 'Third cafe', isLodging: false },
    ] }] } }
    const view = await renderScreen(<SearchScreen />)
    expect(view.getAllByTestId('search-nearby-place')).toHaveLength(2)
    expect(view.queryByText('Third cafe')).toBeNull()
    expect(view.getByText('Hoặc khám phá các quán gần bạn')).toBeTruthy()
    expect(view.queryByText('800 m')).toBeNull()
    expect(view.queryByText(/thịnh hành|Hot tuần này|\/người|Google|GoGo$/)).toBeNull()
    await fireEvent.press(view.getByRole('button', { name: 'Nearby cafe' }))
    expect(mockPush).toHaveBeenLastCalledWith('/places/near')
    await fireEvent.press(view.getByRole('button', { name: 'Xem thêm' }))
    expect(mockQueries.at(-1)).toMatchObject({ lat: 21, lng: 105 })
    expect(mockQueries.at(-1)?.moods).toBeUndefined()
    expect(mockQueries.at(-1)?.q).toBeUndefined()
  })

  it.each([{ isPaused: true }, { isFetching: true }, { isPlaceholderData: true }, { isFetchedAfterMount: false, isStale: true }, { isSuccess: false }])('hides nearby cached rows while not current (%j)', async state => {
    mockNearby.value = { ...emptyPage(), ...state, data: { pages: [{ results: [{ id: 'old', name: 'Stale nearby', isLodging: false }] }] } }
    const view = await renderScreen(<SearchScreen />)
    expect(view.queryByTestId('search-nearby')).toBeNull()
  })

  it('shows verified on the nearby thumbnail and separate ratings while omitting small-card prices', async () => {
    mockNearby.value = { ...emptyPage(), data: { pages: [{ results: [
      { id: 'verified', name: 'Verified cafe', isLodging: false, verification: { status: 'verified' }, rating: 4.6, ratingCount: 980, gogoRating: 4.8, gogoRatingCount: 20, pricePerPerson: { min: 65000, max: 65000, currency: 'VND', confidence: 1 } },
      { id: 'unknown', name: 'Unknown facts', isLodging: false },
    ] }] } }
    const view = await renderScreen(<SearchScreen />)
    const [known, unknown] = view.getAllByTestId('search-nearby-place').map(row => within(row))
    expect(within(known.getByTestId('place-card-photo')).getByText('Xác minh')).toBeTruthy()
    expect(within(known.getByTestId('place-card-body')).queryByText('Xác minh')).toBeNull()
    expect(known.getByLabelText(/4,6 \(980\) Google/)).toBeTruthy()
    expect(known.getByLabelText('★ 4,8 (20) GoGo')).toBeTruthy()
    expect(known.queryByText(/65k/)).toBeNull()
    expect(unknown.queryByTestId('place-gogo-rating')).toBeNull()
    expect(unknown.queryByText(/Xác minh|Google|65k|người/)).toBeNull()
  })
})

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
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/places/search', params: { suggestions: '1', moods: 'cozy' } })
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
  await fireEvent.press(resetView.getByLabelText('Đặt lại'))
  await fireEvent.press(resetView.getByText('Áp dụng bộ lọc'))
  expect(mockQueries.at(-1)?.moods).toBeUndefined()
})

function httpResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body, text: async () => JSON.stringify(body) } as Response
}

it.each([7, 0, undefined])('empty recovery uses real search/preview HTTP and never invents counts (%s)', async count => {
  mockRealSearch = true
  mockParams = { q: 'tea', moods: 'cozy,quiet' }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  notifyManager.setScheduler(callback => callback())
  const fetch = jest.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const url = new URL(String(input))
    const limit = url.searchParams.get('limit')
    if (limit === '1') {
      if (url.searchParams.has('includeTotal') && count === undefined) return httpResponse({ code: 'SEARCH_COUNT_UNAVAILABLE', message: 'Unavailable' }, 503)
      return httpResponse({ results: [], nextCursor: null, meta: count === undefined ? {} : { totalCount: count } })
    }
    const results = limit === '2' ? [{ id: 'near', name: 'Nearby from HTTP', isLodging: false }]
      : url.searchParams.has('moods') ? [] : [{ id: 'recovered', name: 'Recovered from HTTP', isLodging: false }]
    return httpResponse({ results, nextCursor: null, meta: { totalCount: results.length } })
  })
  try {
    const view = await renderScreen(<QueryClientProvider client={client}><SearchScreen /></QueryClientProvider>)
    await waitFor(() => expect(client.isFetching()).toBe(0))
    expect(view.getByText('Nearby from HTTP')).toBeTruthy()
    const urls = fetch.mock.calls.map(([input]) => new URL(String(input)))
    const nearby = urls.find(url => url.searchParams.get('limit') === '2')!
    expect(nearby.searchParams.get('lat')).toBe('21')
    expect(nearby.searchParams.get('lng')).toBe('105')
    expect(nearby.searchParams.has('q')).toBe(false)
    expect(nearby.searchParams.has('moods')).toBe(false)
    const preview = urls.find(url => url.searchParams.get('limit') === '1')!
    expect(preview.searchParams.get('q')).toBe('tea')
    expect(preview.searchParams.get('lat')).toBe('21')
    expect(preview.searchParams.get('lng')).toBe('105')
    expect(preview.searchParams.has('moods')).toBe(false)
    expect(preview.searchParams.get('includeTotal')).toBe('true')
    expect(view.getByText(i18n.t('discovery.contributeTitle'))).toBeTruthy()
    if (count) {
      expect(view.getByText('+7 quán phù hợp')).toBeTruthy()
      await fireEvent.press(view.getByRole('button', { name: /Bỏ chọn: Bỏ tiêu chí/ }))
      await waitFor(() => expect(view.getByText('Recovered from HTTP')).toBeTruthy())
      expect(view.queryByTestId('search-empty-content')).toBeNull()
      expect(view.queryByText(i18n.t('discovery.contributeTitle'))).toBeNull()
      expect(view.queryByRole('button', { name: i18n.t('discovery.addPlace') })).toBeNull()
    } else {
      expect(view.queryByTestId('search-relaxations')).toBeNull()
      expect(view.getByText(i18n.t('discovery.emptyTitle'))).toBeTruthy()
    }
    await view.unmount()
  } finally {
    client.clear()
    fetch.mockRestore()
  }
})

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

  it('preserves the query when opening notifications and opens the public location sheet', async () => {
    const view = await renderScreen(<SearchScreen />)
    await fireEvent.changeText(view.getByLabelText('Tìm địa điểm'), 'retained query')
    await fireEvent.press(view.getByRole('button', { name: i18n.t('notifications.title') }))
    expect(mockPush).toHaveBeenCalledWith('/notifications')
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

describe('#561 marker selection and compact map card', () => {
  it.each([['orange', 'vi'], ['orange', 'en'], ['orangeDark', 'vi'], ['orangeDark', 'en']] as const)('shows real fields and protected rating facts in %s / %s', async (themeName, language) => {
    await act(async () => { await i18n.changeLanguage(language) })
    UnistylesStyleSheet.configure({ themes: { orange: themes[themeName] } as typeof themes })
    try {
      mockSearch.value = { ...emptyPage(), data: { pages: [{ results: [{
        ...mapPlaces[0], addressText: '12 Nguyễn Huệ',
        taxonomies: [{ kind: 'category', key: 'cafe' }],
        rating: 4.6, ratingCount: 980, gogoRatingCount: 3,
        open: { openNow: true, closesAtMinute: 1200 },
      }], meta: {} }] } }
      const view = await renderScreen(<SearchScreen />)
      await fireEvent.press(view.getByText(i18n.t('discovery.map')))
      expect(view.queryByTestId('app-tab-dock')).toBeNull()
      expect(view.queryByRole('tab', { name: i18n.t('tabs.home') })).toBeNull()
      expect(view.queryByTestId('search-map-card')).toBeNull()
      const select = async () => fireEvent.press(within(view.getByTestId('discovery-native-map')).getByLabelText('Top place'))
      await select()
      const card = within(view.getByTestId('search-map-card'))
      expect(view.getByTestId('discovery-native-map').props.pins).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'top', category: 'cafe', selected: true })]))
      expect(card.getByTestId('place-card-small')).toBeTruthy()
      expect(card.getByTestId('place-photo-placeholder', { includeHiddenElements: true })).toBeTruthy()
      expect(mockPush).not.toHaveBeenCalled()
      expect(card.getByTestId('place-card-name')).toHaveTextContent('Top place')
      expect(card.getByTestId('place-card-meta')).toHaveTextContent('12 Nguyễn Huệ')
      expect(card.getByTestId('place-card-body').children.filter(child => typeof child !== 'string').map(child => child.props.testID)).toEqual(['place-card-name', 'place-card-address-row', 'place-card-ratings'])
      expect(card.getByTestId('place-card-ratings').children.filter(child => typeof child !== 'string').map(child => child.props.testID)).toEqual(['place-gogo-rating', 'place-google-rating'])
      expect(StyleSheet.flatten(card.getByTestId('place-card-ratings').props.style)).toMatchObject({ flexDirection: 'column', flexWrap: 'nowrap' })
      expect(card.getByTestId('place-gogo-rating')).toHaveTextContent(language === 'vi' ? 'GoGo · 3 đánh giá' : 'GoGo · 3 reviews', { exact: true })
      expect(card.getByLabelText(language === 'vi' ? '★ 4,6 (980) Google' : '★ 4.6 (980) Google')).toBe(card.getByTestId('place-google-rating'))
      for (const id of ['place-gogo-rating-source', 'place-gogo-rating-count', 'place-google-rating-score', 'place-google-rating-count', 'place-google-rating-source']) {
        const fact = card.getByTestId(id)
        expect(fact.props.numberOfLines).toBeUndefined()
        expect(fact.props.ellipsizeMode).toBeUndefined()
        expect(StyleSheet.flatten(fact.props.style).flexShrink).toBe(0)
      }
      for (const id of ['place-gogo-rating', 'place-google-rating']) {
        expect(StyleSheet.flatten(card.getByTestId(id).props.style)).toMatchObject({ maxWidth: '100%', flexShrink: 1 })
      }
      for (const text of ['Cà phê', 'Mở đến 20:00']) expect(card.queryByText(text)).toBeNull()
      for (const id of ['place-card-price', 'place-card-hours-badge', 'place-card-tags', 'place-card-distance']) expect(card.queryByTestId(id)).toBeNull()
      expect(StyleSheet.flatten(view.getByTestId('search-map-card').props.style).bottom).toBe(34 + 16)
      await fireEvent.press(card.getByTestId('place-card-save'))
      expect(mockToggleSaved).toHaveBeenCalledWith({ type: 'place', id: 'top', saved: false })
      expect(mockPush).not.toHaveBeenCalled()
      await fireEvent(view.getByTestId('discovery-native-map'), 'onDeselect')
      expect(view.queryByTestId('search-map-card')).toBeNull()
      await select()
      await act(async () => {
        fireGestureHandler<ReturnType<typeof Gesture.Pan>>(getByGestureTestId('map-card-dismiss'), [
          { state: State.BEGAN, translationY: 0 },
          { state: State.ACTIVE, translationY: 30 },
          { state: State.END, translationY: 35 },
        ])
      })
      expect(view.getByTestId('search-map-card')).toBeTruthy()
      await act(async () => {
        fireGestureHandler<ReturnType<typeof Gesture.Pan>>(getByGestureTestId('map-card-dismiss'), [
          { state: State.BEGAN, translationY: 0 },
          { state: State.ACTIVE, translationY: 60 },
          { state: State.END, translationY: 100 },
        ])
      })
      expect(view.queryByTestId('search-map-card')).toBeNull()
      await select()
      await fireEvent.press(view.getByTestId('place-card-open-target'))
      expect(mockPush).toHaveBeenCalledWith('/places/top')
      expect(view.queryByRole('tab', { name: i18n.t('tabs.plans') })).toBeNull()
    } finally {
      UnistylesStyleSheet.configure({ themes })
      await act(async () => { await i18n.changeLanguage('vi') })
    }
  })
})

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
      await fireEvent.press(view.getByTestId('place-card-open-target'))
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
    expect(view.queryByTestId('search-map-card')).toBeNull()
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


describe('#515 owner — shared Home/Search notifications and Home suggestions', () => {
  it.each(
    [{ screen: 'home', Screen: HomeScreen }, { screen: 'search', Screen: SearchScreen }].flatMap(screen =>
      [{ count: 0, more: false, spokenCount: '' }, { count: 3, more: false, spokenCount: '3' }, { count: 3, more: true, spokenCount: '3+' }, { count: 12, more: false, spokenCount: '9+' }].map(unread => ({ ...screen, ...unread }))),
  )('$screen has one header notification entry, no avatar, and preserves unread behaviour ($count/$more)', async ({ screen, Screen, count, more, spokenCount }) => {
    mockUnread = { count, more }
    const view = await renderScreen(<Screen />)
    const header = within(view.getByTestId(`${screen}-header`))
    const bell = header.getByTestId(`${screen}-bell`)
    expect(view.getAllByTestId(`${screen}-bell`)).toHaveLength(1)
    const label = count ? i18n.t('home.bellUnread', { count: spokenCount }) : i18n.t('notifications.title')
    expect(view.getAllByRole('button', { name: label })).toHaveLength(1)
    expect(view.queryByRole('button', { name: i18n.t('profile.title') })).toBeNull()
    expect(header.queryByTestId('avatar-image')).toBeNull()
    const target = StyleSheet.flatten(bell.props.style)
    expect(target.width).toBeGreaterThanOrEqual(44)
    expect(target.height).toBeGreaterThanOrEqual(44)
    expect(header.queryByTestId(`${screen}-unread-dot`) !== null).toBe(count > 0)
    await fireEvent.press(bell)
    expect(mockPush).toHaveBeenCalledWith('/notifications')
    expect(mockPush).toHaveBeenCalledTimes(1)
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
      expect(mockParams).toMatchObject({ suggestions: '1', moods: 'cozy' })
      await home.unmount()
      // Home and Search subscribe to the same resolved scope.
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
    mockScope = { status: 'ready', source: 'default_area', area }
    useDiscoveryAreaStore.setState({ area })
    mockParams = { suggestions: '1' }
    await renderScreen(<SearchScreen />)
    expect(mockQueries.at(-1)).toMatchObject({ limit: 10, datasetVersion: 'v1', provinceCode: 'home-province', communeCode: 'home-commune' })
    expect(mockQueries.at(-1)?.lat).toBeUndefined()
    mockScope = { status: 'ready', source: 'selected_area', area: previousArea }
    await act(async () => { useDiscoveryAreaStore.setState({ area: { ...previousArea } }) })
    expect(mockQueries.at(-1)?.provinceCode).toBe('previous-province')
  })

  it('keeps cards and exposes a retry footer after a next-page failure', async () => {
    mockParams = { suggestions: '1' }
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
    expect(section.getByText('Ấm cúng')).toBeTruthy()
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
    const [full, sparse] = view.getAllByTestId('place-card-large').map(card => within(card))
    expect(full.getByText('Xác minh')).toBeTruthy()
    expect(full.queryByTestId('place-card-area-badge')).toBeNull()
    expect(full.getByText('Mở đến 20:00')).toBeTruthy()
    expect(full.getByText('45k–90k/người')).toBeTruthy()
    expect(full.getByText('12 Nguyễn Huệ').props.numberOfLines).toBe(2)
    expect(full.getByText('Địa điểm từ API').props.numberOfLines).toBe(1)
    expect(full.getByLabelText('★ 4,6 (980) Google')).toBeTruthy()
    expect(full.getByLabelText('★ 4,9 (20) GoGo')).toBeTruthy()
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
    expect(StyleSheet.flatten(group.props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap', gap: 4 })
    const presets = view.getByTestId('price-presets')
    expect(within(presets).getAllByRole('button')).toHaveLength(3)
    expect(StyleSheet.flatten(presets.props.style)).toMatchObject({ flexWrap: 'wrap', gap: 4 })
    expect(view.getByLabelText(i18n.t('search.priceFromLabel')).props.placeholder).toBeUndefined()
    expect(view.getByLabelText(i18n.t('search.priceToLabel')).props.placeholder).toBeUndefined()
  })

  it('shows a selected mood with a heavier label and the Stitch chip surface', async () => {
    mockKinds = { mood: [{ key: 'cozy', labels: { vi: 'Ấm cúng' } }] }
    const view = await renderScreen(<HomeScreen />)
    const chip = () => view.getByLabelText('Ấm cúng')
    const surface = () => StyleSheet.flatten(chip().queryAll(node => node.type === 'View' && StyleSheet.flatten(node.props.style)?.height === 36)[0].props.style)
    expect(chip().props.accessibilityState.selected).toBe(false)
    expect(surface()).toMatchObject({ height: 36, paddingHorizontal: 14, backgroundColor: '#FFFFFF' })
    expect(chip().props.hitSlop.top + surface().height + chip().props.hitSlop.bottom).toBeGreaterThanOrEqual(44)
    await fireEvent.press(chip())
    expect(chip().props.accessibilityState.selected).toBe(true)
    expect(view.queryByText('✓ Ấm cúng')).toBeNull()
    expect(StyleSheet.flatten(view.getByText('Ấm cúng').props.style).fontFamily).toBe('Inter-SemiBold')
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


it('ignores stale route scope and follows the app-wide area for suggestions', async () => {
  mockParams = { suggestions: '1', suggestionScope: JSON.stringify({ status: 'ready', source: 'gps', position: { lat: 10, lng: 106 } }) }
  mockScope = { status: 'ready', source: 'gps', position: { lat: 21, lng: 105 } }
  const view = await renderScreen(<SearchScreen />)
  expect(mockQueries.at(-1)).toMatchObject({ lat: 21, lng: 105 })
  mockScope = { status: 'ready', source: 'gps', position: { lat: 11, lng: 107 } }
  await view.rerender(<SearchScreen />)
  expect(mockQueries.at(-1)).toMatchObject({ lat: 11, lng: 107 })
})

describe('#515 Astra F-12..F-14', () => {
  it.each(['remount', 'close filters'])('F-12 keeps fresh empty results, counts and nearby recovery after %s with production staleTime', async action => {
    mockRealSearch = true
    mockParams = { q: 'tea', moods: 'cozy' }
    const client = createQueryClient()
    expect(client.getDefaultOptions().queries?.staleTime).toBe(30_000)
    notifyManager.setScheduler(callback => callback())
    const fetch = jest.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = new URL(String(input))
      const limit = url.searchParams.get('limit')
      const results = limit === '2' ? [{ id: 'near', name: 'Fresh nearby', isLodging: false }] : []
      return httpResponse({ results, nextCursor: null, meta: { totalCount: limit === '1' ? 7 : results.length } })
    })
    const element = <QueryClientProvider client={client}><SearchScreen /></QueryClientProvider>
    try {
      let view = await renderScreen(element)
      await waitFor(() => expect(view.getByText('Fresh nearby')).toBeTruthy())
      expect(view.getByText('+7 quán phù hợp')).toBeTruthy()
      const requests = fetch.mock.calls.length
      if (action === 'remount') {
        await view.unmount()
        await act(async () => { await jest.advanceTimersByTimeAsync(1000) })
        view = await renderScreen(element)
      } else {
        await fireEvent.press(view.getByLabelText(i18n.t('search.filters')))
        expect(view.queryByTestId('search-empty-content')).toBeNull()
        await fireEvent.press(view.getByLabelText(i18n.t('common.close')))
      }
      expect(view.getByTestId('search-empty-content')).toBeTruthy()
      expect(view.getByText('Tìm thấy 0 địa điểm')).toBeTruthy()
      expect(view.getByText('+7 quán phù hợp')).toBeTruthy()
      expect(view.getByText('Fresh nearby')).toBeTruthy()
      expect(fetch).toHaveBeenCalledTimes(requests)
      await view.unmount()
    } finally {
      client.clear()
      notifyManager.setScheduler(callback => setTimeout(callback, 0))
    }
  })

  it.each([false, true])('F-13 selects a seed from the shared map card (existing room: %s)', async existingRoom => {
    mockParams = { picker: '1', ...(existingRoom ? { roomId: 'room-1' } : {}) }
    mockSearch.value = mapPages()
    const view = await renderScreen(<SearchScreen />)
    await fireEvent.press(view.getByText(i18n.t('discovery.map')))
    await fireEvent.press(view.getByLabelText(mapPlaces[1].name))
    await fireEvent.press(view.getByTestId('place-card-open-target'))
    expect(mockPush).not.toHaveBeenCalled()
    if (existingRoom) {
      expect(mockAddSeed).toHaveBeenCalledTimes(1)
      expect(mockAddSeed).toHaveBeenCalledWith({ placeIds: ['second'] }, expect.objectContaining({ onSuccess: expect.any(Function) }))
      expect(useRoomStore.getState().seedPlaces).toEqual([])
      expect(mockBack).not.toHaveBeenCalled()
      await act(async () => { mockAddSeed.mock.calls[0][1].onSuccess() })
    } else {
      expect(useRoomStore.getState().seedPlaces).toContainEqual({ placeId: 'second', name: mapPlaces[1].name })
      expect(mockAddSeed).not.toHaveBeenCalled()
    }
    expect(mockBack).toHaveBeenCalledTimes(1)
  })

  it('F-13 keeps ordinary map cards opening place detail', async () => {
    mockSearch.value = mapPages()
    const view = await renderScreen(<SearchScreen />)
    await fireEvent.press(view.getByText(i18n.t('discovery.map')))
    await fireEvent.press(view.getByLabelText(mapPlaces[1].name))
    await fireEvent.press(view.getByTestId('place-card-open-target'))
    expect(mockPush).toHaveBeenCalledWith('/places/second')
    expect(mockAddSeed).not.toHaveBeenCalled()
    expect(useRoomStore.getState().seedPlaces).toEqual([])
  })

  it('F-14 loads all cursor pages from map, preserves markers through failure/retry, and stops at null', async () => {
    mockRealSearch = true
    mockParams = { q: 'tea', moods: 'cozy' }
    const client = createQueryClient()
    client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } })
    notifyManager.setScheduler(callback => callback())
    let failSecond = true
    let resolveSecond: ((value: Response) => void) | undefined
    const page = (index: number) => httpResponse({
      results: [{ id: `map-${index}`, name: `Map page ${index}`, isLodging: false, lat: 21 + index / 100, lng: 105 }],
      nextCursor: index === 3 ? null : `page-${index + 1}`, meta: { totalCount: 3 },
    })
    const fetch = jest.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const cursor = new URL(String(input)).searchParams.get('cursor')
      if (cursor === 'page-2') {
        if (failSecond) { failSecond = false; return httpResponse({ code: 'INTERNAL_ERROR', message: 'Page failed' }, 500) }
        return new Promise<Response>(resolve => { resolveSecond = resolve })
      }
      return page(cursor === 'page-3' ? 3 : 1)
    })
    try {
      const view = await renderScreen(<QueryClientProvider client={client}><SearchScreen /></QueryClientProvider>)
      await waitFor(() => expect(view.getByText('Map page 1')).toBeTruthy())
      await fireEvent.press(view.getByText(i18n.t('discovery.map')))
      expect(view.queryByTestId('search-results')).toBeNull()
      expect(view.queryByRole('button', { name: i18n.t('discovery.more') })).toBeNull()
      await waitFor(() => expect(view.getByRole('button', { name: i18n.t('common.retry') })).toBeTruthy())
      expect(within(view.getByTestId('discovery-native-map')).getByLabelText('Map page 1')).toBeTruthy()
      expect(fetch).toHaveBeenCalledTimes(2)
      await fireEvent.press(view.getByRole('button', { name: i18n.t('common.retry') }))
      await waitFor(() => expect(resolveSecond).toBeDefined())
      expect(view.getByTestId('search-loading-more')).toBeTruthy()
      expect(view.queryByRole('button', { name: i18n.t('discovery.more') })).toBeNull()
      await act(async () => { resolveSecond!(page(2)) })
      await waitFor(() => expect(view.getByLabelText('Map page 2')).toBeTruthy())
      await waitFor(() => expect(view.getByLabelText('Map page 3')).toBeTruthy())
      for (const index of [1, 2, 3]) expect(within(view.getByTestId('discovery-native-map')).getByLabelText(`Map page ${index}`)).toBeTruthy()
      expect(view.queryByRole('button', { name: i18n.t('discovery.more') })).toBeNull()
      const urls = fetch.mock.calls.map(([input]) => new URL(String(input)))
      expect(urls.map(url => url.searchParams.get('cursor'))).toEqual([null, 'page-2', 'page-2', 'page-3'])
      for (const url of urls) {
        expect(url.searchParams.get('q')).toBe('tea')
        expect(url.searchParams.get('moods')).toBe('cozy')
        expect(url.searchParams.get('lat')).toBe('21')
        expect(url.searchParams.get('lng')).toBe('105')
        expect(url.searchParams.get('limit')).toBe('10')
      }
      expect(urls.slice(1).every(url => !url.searchParams.has('includeTotal'))).toBe(true)
      await fireEvent.press(view.getByText(i18n.t('discovery.list')))
      expect(view.getByTestId('search-results').props.data).toHaveLength(3)
      await fireEvent(view.getByTestId('search-results'), 'onEndReached')
      await fireEvent.press(view.getByText(i18n.t('discovery.map')))
      expect(fetch).toHaveBeenCalledTimes(4)
      await view.unmount()
    } finally {
      client.clear()
      notifyManager.setScheduler(callback => setTimeout(callback, 0))
    }
  })
})

it('drains map pages only while active, once per cursor, and resets for a changed query', async () => {
  const fetchNextPage = jest.fn()
  let sequence = 0
  const page = (cursor: string) => ({ results: [{ id: `pin-${++sequence}`, name: 'Pin', lat: 21, lng: 105, isLodging: false }], nextCursor: cursor })
  mockSearch.value = { ...emptyPage(), fetchNextPage, hasNextPage: true, data: { pages: [page('next')] } }
  const view = await renderScreen(<SearchScreen />)
  expect(fetchNextPage).not.toHaveBeenCalled()
  await fireEvent.press(view.getByText(i18n.t('discovery.map')))
  expect(fetchNextPage).toHaveBeenCalledTimes(1)
  expect(fetchNextPage).toHaveBeenLastCalledWith({ cancelRefetch: false })
  await view.rerender(<SearchScreen />)
  expect(fetchNextPage).toHaveBeenCalledTimes(1)
  await fireEvent.press(view.getByText(i18n.t('discovery.list')))
  mockSearch.value = { ...mockSearch.value, data: { pages: [page('next'), page('next-2')] } }
  await view.rerender(<SearchScreen />)
  expect(fetchNextPage).toHaveBeenCalledTimes(1)
  await fireEvent.press(view.getByText(i18n.t('discovery.map')))
  expect(fetchNextPage).toHaveBeenCalledTimes(2)
  // A malformed server cursor must not start a background request loop.
  mockSearch.value = { ...mockSearch.value, data: { pages: [page('next'), page('next-2'), page('next')] } }
  await view.rerender(<SearchScreen />)
  expect(fetchNextPage).toHaveBeenCalledTimes(2)
  await fireEvent.changeText(view.getByLabelText('Tìm địa điểm'), 'coffee')
  expect(fetchNextPage).toHaveBeenCalledTimes(2)
  await act(async () => { await jest.advanceTimersByTimeAsync(300) })
  expect(fetchNextPage).toHaveBeenCalledTimes(3)
})

it('expands on an upward header swipe, hides header/filters, and returns by control, back and downward swipe', async () => {
  mockSearch.value = mapPages()
  const view = await renderScreen(<SearchScreen />)
  await fireEvent.press(view.getByText(i18n.t('discovery.map')))
  async function swipe(from: number, to: number) {
    await fireEvent(view.getByTestId('search-map-expand-handle'), 'touchStart', { nativeEvent: { pageX: 100, pageY: from } })
    await fireEvent(view.getByTestId('search-map-expand-handle'), 'touchEnd', { nativeEvent: { pageX: 100, pageY: to } })
  }
  await swipe(300, 100)
  expect(view.getByTestId('search-map-fullscreen')).toBeTruthy()
  expect(view.queryByTestId('search-header')).toBeNull()
  expect(view.queryByLabelText(i18n.t('search.filters'))).toBeNull()
  await fireEvent.press(view.getByText(i18n.t('discovery.collapseMap')))
  await act(async () => { await jest.advanceTimersByTimeAsync(240) })
  expect(view.getByTestId('search-header')).toBeTruthy()
  await fireEvent.press(view.getByText(i18n.t('discovery.expandMap')))
  await act(async () => { await jest.advanceTimersByTimeAsync(240) })
  await fireEvent(view.getByTestId('search-map-modal'), 'requestClose')
  await act(async () => { await jest.advanceTimersByTimeAsync(240) })
  expect(view.getByTestId('search-header')).toBeTruthy()
  await swipe(300, 100)
  await act(async () => { await jest.advanceTimersByTimeAsync(240) })
  await swipe(100, 300)
  await act(async () => { await jest.advanceTimersByTimeAsync(240) })
  expect(view.getByTestId('search-header')).toBeTruthy()
  await fireEvent.press(view.getByText(i18n.t('discovery.expandMap')))
  await act(async () => { await jest.advanceTimersByTimeAsync(240) })
  await fireEvent.press(view.getByLabelText(mapPlaces[1].name))
  await fireEvent.press(view.getByTestId('place-card-open-target'))
  await act(async () => { await jest.advanceTimersByTimeAsync(240) })
  expect(view.queryByTestId('search-map-fullscreen')).toBeNull()
  expect(mockPush).toHaveBeenLastCalledWith('/places/second')
})

it.each([
  { isPending: true, isSuccess: false },
  { isPaused: true },
  { isError: true, isSuccess: false, error: new Error('Search failed') },
  { data: emptyPage().data },
])('resets map expansion across unavailable or empty results (%j)', async state => {
  mockSearch.value = mapPages()
  const view = await renderScreen(<SearchScreen />)
  await fireEvent.press(view.getByText(i18n.t('discovery.map')))
  await fireEvent.press(view.getByText(i18n.t('discovery.expandMap')))
  expect(view.getByTestId('search-map-fullscreen')).toBeTruthy()

  mockSearch.value = { ...mapPages(), ...state }
  await view.rerender(<SearchScreen />)
  expect(view.queryByTestId('search-map-fullscreen')).toBeNull()
  expect(view.getByTestId('search-header')).toBeTruthy()

  mockSearch.value = mapPages()
  await view.rerender(<SearchScreen />)
  expect(view.getByTestId('search-map')).toBeTruthy()
  expect(view.queryByTestId('search-map-fullscreen')).toBeNull()
  expect(view.getByTestId('search-header')).toBeTruthy()
})

it.each([
  { isError: true, isPending: false, error: new Error('Viewport failed'), message: 'common.errorTitle' },
  { isError: true, isPending: false, error: new NetworkError(), message: 'common.offlineTitle' },
  { isPaused: true, isPending: true, error: null, message: 'common.offlineTitle' },
])('retains map markers with viewport feedback and the correct retry (%j)', async ({ message, ...state }) => {
  mockSearch.value = mapPages()
  const refetch = jest.fn()
  const fetchNextPage = jest.fn()
  mockRegionSearch = { ...emptyPage(), data: undefined, isSuccess: false, ...state, refetch, fetchNextPage }
  const view = await renderScreen(<SearchScreen />)
  await fireEvent.press(view.getByText(i18n.t('discovery.map')))
  await fireEvent.press(view.getByText(i18n.t('discovery.expandMap')))
  await act(async () => { await jest.advanceTimersByTimeAsync(240) })
  await fireEvent(view.getByTestId('discovery-native-map'), 'regionChangeComplete', { latitude: 10, longitude: 106, latitudeDelta: 0.02, longitudeDelta: 0.02 })
  await act(async () => { await jest.advanceTimersByTimeAsync(400) })
  expect(view.getByTestId('search-map-fullscreen')).toBeTruthy()
  for (const place of mapPlaces) expect(view.getByLabelText(place.name)).toBeTruthy()
  expect(view.getByText(i18n.t(message))).toBeTruthy()
  const retry = view.queryByRole('button', { name: i18n.t('common.retry') })
  if (state.isPaused) expect(retry).toBeNull()
  else {
    await fireEvent.press(retry!)
    expect(refetch).toHaveBeenCalledTimes(1)
    mockRegionSearch = { ...mockRegionSearch, isFetching: true }
    await view.rerender(<SearchScreen />)
    expect(view.queryByRole('button', { name: i18n.t('common.retry') })).toBeNull()
  }
  expect(fetchNextPage).not.toHaveBeenCalled()
  expect(mockSearch.value.refetch).not.toHaveBeenCalled()
  mockRegionSearch = { ...emptyPage(), data: { pages: [{ results: [], meta: {} }] } }
  await view.rerender(<SearchScreen />)
  expect(view.queryByText(i18n.t(message))).toBeNull()
  for (const place of mapPlaces) expect(view.getByLabelText(place.name)).toBeTruthy()
})

it('debounces visible-region search, keeps filters/keyword and header area, merges markers and preserves selection', async () => {
  mockParams = { q: 'tea', moods: 'cozy' }
  mockScope = { status: 'ready', source: 'selected_area', area: { datasetVersion: 'ds', provinceCode: '01', provinceName: 'Hà Nội', communeCode: null, communeName: null } }
  useDiscoveryAreaStore.setState({ area: mockScope.area })
  mockSearch.value = mapPages()
  mockSearch.value.data = { pages: [{ results: mapPlaces, meta: { location: { source: 'administrative_area', area: { provinceName: 'Hà Nội' } } } }] }
  const view = await renderScreen(<SearchScreen />)
  await fireEvent.press(view.getByText(i18n.t('discovery.map')))
  const cameraScopeKey = view.getByTestId('discovery-native-map').props.cameraScopeKey
  expect(cameraScopeKey).toEqual(expect.any(String))
  await fireEvent.press(view.getByLabelText('Top place'))
  mockRegionSearch = { ...emptyPage(), data: undefined, isSuccess: false, isPending: true, isFetching: true }
  const region = { latitude: 10, longitude: 106, latitudeDelta: 0.02, longitudeDelta: 0.02 }
  await fireEvent(view.getByTestId('discovery-native-map'), 'regionChangeComplete', { ...region, latitude: 11 })
  await act(async () => { await jest.advanceTimersByTimeAsync(300) })
  await fireEvent(view.getByTestId('discovery-native-map'), 'regionChangeComplete', region)
  await act(async () => { await jest.advanceTimersByTimeAsync(399) })
  expect(mockQueries.some(query => query.radiusM !== undefined)).toBe(false)
  await act(async () => { await jest.advanceTimersByTimeAsync(1) })
  expect(view.getByTestId('discovery-native-map').props.cameraScopeKey).toBe(cameraScopeKey)
  expect(mockQueries.at(-1)).toMatchObject({ lat: 10, lng: 106, q: 'tea', moods: 'cozy' })
  expect(mockQueries.at(-1)?.radiusM).toBeGreaterThan(1500)
  for (const key of ['datasetVersion', 'provinceCode', 'communeCode']) expect(mockQueries.at(-1)).not.toHaveProperty(key)
  expect(view.getByTestId('search-loading-more')).toBeTruthy()
  expect(view.getByText('Hà Nội')).toBeTruthy()
  expect(view.getByTestId('search-map-card')).toBeTruthy()
  const newPlace = { ...mapPlaces[0], id: 'new', name: 'Visible place', lat: 10, lng: 106 }
  mockRegionSearch = { ...emptyPage(), data: { pages: [{ results: [newPlace, mapPlaces[0]], meta: { location: { source: 'position' } } }] } }
  await view.rerender(<SearchScreen />)
  for (const title of ['Top place', 'Second place', 'Visible place']) expect(within(view.getByTestId('discovery-native-map')).getAllByLabelText(title)).toHaveLength(1)
  expect(view.getByTestId('search-map-card')).toBeTruthy()
  expect(view.getByText('Hà Nội')).toBeTruthy()
  expect(useDiscoveryAreaStore.getState().area).toEqual(mockScope.status === 'ready' && 'area' in mockScope ? mockScope.area : null)
  await fireEvent(view.getByTestId('discovery-native-map'), 'regionChangeComplete', { ...region, latitudeDelta: 90, longitudeDelta: 180 })
  await act(async () => { await jest.advanceTimersByTimeAsync(400) })
  expect(mockQueries.at(-1)?.radiusM).toBe(100000)
  mockRegionSearch = { ...emptyPage(), data: { pages: [{ results: [], meta: {} }] } }
  await view.rerender(<SearchScreen />)
  expect(view.getByLabelText('Visible place')).toBeTruthy()
  await fireEvent.press(view.getByTestId('place-card-open-target'))
  expect(mockPush).toHaveBeenLastCalledWith('/places/top')
  await fireEvent.changeText(view.getByLabelText(i18n.t('search.title')), 'coffee')
  await act(async () => { await jest.advanceTimersByTimeAsync(300) })
  expect(view.getByTestId('discovery-native-map').props.cameraScopeKey).not.toBe(cameraScopeKey)
  expect(mockQueries.at(-1)).toMatchObject({ q: 'coffee', provinceCode: '01' })
  expect(mockQueries.at(-1)).not.toHaveProperty('radiusM')
  expect(view.queryByLabelText('Visible place')).toBeNull()
  expect(view.queryByTestId('search-map-card')).toBeNull()
})


it.each(['orange', 'orangeDark'] as const)('keeps area selection in the header and preserves it on filter reset in %s', async themeName => {
  const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
  const { rt } = unistyles.useUnistyles()
  jest.spyOn(unistyles, 'useUnistyles').mockReturnValue({ theme: themes[themeName], rt: { ...rt, themeName } })
  const area = { datasetVersion: 'ds-2026', provinceCode: '79', provinceName: 'Thành phố Hồ Chí Minh', communeCode: '26734', communeName: 'Phường Bến Thành' }
  useDiscoveryAreaStore.setState({ area })
  mockScope = { status: 'ready', source: 'selected_area', area }
  mockParams = { categories: 'cafe' }
  const view = await renderScreen(<SearchScreen />)
  await fireEvent.press(view.getByLabelText(i18n.t('search.filters')))
  expect(view.getByText(i18n.t('discovery.filterTitle'))).toBeTruthy()
  expect(view.queryByRole('button', { name: /^Chọn khu vực:/ })).toBeNull()
  expect(view.queryByTestId('discovery-location-sheet')).toBeNull()
  await fireEvent.press(view.getByText(i18n.t('discovery.openNow')))
  await fireEvent.press(view.getByText(i18n.t('discovery.resetDefaults')))
  expect(view.getByLabelText(i18n.t('discovery.openNow')).props.accessibilityState.selected).toBe(false)
  expect(view.getByLabelText('Cà phê').props.accessibilityState.selected).toBe(false)
  await fireEvent.press(view.getByText(i18n.t('discovery.apply')))
  expect(view.queryByTestId('amenity-status-options')).toBeNull()
  expect(mockQueries.at(-1)).toMatchObject({ datasetVersion: area.datasetVersion, provinceCode: area.provinceCode, communeCode: area.communeCode })
  expect(mockQueries.at(-1)).not.toHaveProperty('categories')
  expect(mockQueries.at(-1)).not.toHaveProperty('openNow')
  expect(useDiscoveryAreaStore.getState().area).toEqual(area)
  expect(within(view.getByTestId('search-header')).getByText('Phường Bến Thành, Thành phố Hồ Chí Minh')).toBeTruthy()
  expect(view.queryByTestId('discovery-location-sheet')).toBeNull()
  await fireEvent.press(within(view.getByTestId('search-header')).getByRole('button', { name: i18n.t('home.chooseArea') }))
  expect(view.getByTestId('discovery-location-sheet')).toBeTruthy()
  expect(view.getAllByTestId('sheet-drag-handle')).toHaveLength(1)
})

it('g04 opens ordinary Search with the saved category and canonical area, without AI', async () => {
  const area = { datasetVersion: 'ds-2026', provinceCode: '79', provinceName: 'Thành phố Hồ Chí Minh', communeCode: '26734', communeName: 'Phường Bến Thành' }
  const appArea = { ...area, provinceCode: '01', provinceName: 'Hà Nội', communeCode: null, communeName: null }
  useDiscoveryAreaStore.setState({ area: appArea })
  mockScope = { status: 'ready', source: 'selected_area', area: appArea }
  mockParams = { categories: 'cafe', suggestions: '1', suggestionScope: JSON.stringify({ status: 'ready', source: 'selected_area', area }) }
  const view = await renderScreen(<SearchScreen />)
  expect(mockQueries.at(-1)).toMatchObject({ categories: 'cafe', provinceCode: '79', communeCode: '26734' })
  expect(mockQueries.at(-1)?.lat).toBeUndefined()
  expect(within(view.getByTestId('search-header')).getByText('Phường Bến Thành, Thành phố Hồ Chí Minh')).toBeTruthy()
  expect(within(view.getByTestId('search-header')).queryByText('Hà Nội')).toBeNull()
  await fireEvent.press(view.getByLabelText('Bộ lọc'))
  expect(view.getByText(i18n.t('discovery.filterTitle'))).toBeTruthy()
  expect(view.queryByRole('button', { name: /^Chọn khu vực:/ })).toBeNull()
})

it('keeps the app-wide scope after changing areas and returning to the entry area', async () => {
  const entryArea = { datasetVersion: 'ds-2026', provinceCode: '01', provinceName: 'Hà Nội', communeCode: null, communeName: null }
  const savedArea = { ...entryArea, provinceCode: '79', provinceName: 'Thành phố Hồ Chí Minh' }
  const nextArea = { ...entryArea, provinceCode: '48', provinceName: 'Đà Nẵng' }
  useDiscoveryAreaStore.setState({ area: entryArea })
  mockScope = { status: 'ready', source: 'selected_area', area: entryArea }
  mockParams = { categories: 'cafe', suggestions: '1', suggestionScope: JSON.stringify({ status: 'ready', source: 'selected_area', area: savedArea }) }
  const view = await renderScreen(<SearchScreen />)
  expect(mockQueries.at(-1)).toMatchObject({ provinceCode: '79' })
  expect(within(view.getByTestId('search-header')).getByText('Thành phố Hồ Chí Minh')).toBeTruthy()

  mockScope = { status: 'ready', source: 'selected_area', area: nextArea }
  await act(async () => { useDiscoveryAreaStore.setState({ area: nextArea }) })
  expect(mockQueries.at(-1)).toMatchObject({ provinceCode: '48' })
  expect(within(view.getByTestId('search-header')).getByText('Đà Nẵng')).toBeTruthy()

  mockScope = { status: 'ready', source: 'selected_area', area: entryArea }
  await act(async () => { useDiscoveryAreaStore.setState({ area: entryArea }) })
  expect(mockQueries.at(-1)).toMatchObject({ provinceCode: '01' })
  expect(within(view.getByTestId('search-header')).getByText('Hà Nội')).toBeTruthy()
})

it('pulls to refresh the explore list and requests pages of ten', async () => {
  const refetch = jest.fn().mockResolvedValue(undefined)
  mockSearch.value = { ...emptyPage(), refetch }
  const screen = await renderScreen(<SearchScreen />)
  await act(async () => { screen.getByTestId('search-results').props.refreshControl.props.onRefresh() })
  expect(refetch).toHaveBeenCalledTimes(1)
  expect(mockQueries.at(-1)).toMatchObject({ limit: 10 })
})


it.each(['home', 'search-list', 'search-map'])('%s uses place-card skeletons without a loading mark on page one (#619)', async screen => {
  mockSearch.value = { ...emptyPage(), data: undefined, isPending: true, isSuccess: false }
  mockPreview.value = { isPending: true, isFetching: true, data: undefined }
  const view = await renderScreen(screen === 'home' ? <HomeScreen /> : <SearchScreen />)
  if (screen === 'search-list') await fireEvent.press(view.getByRole('tab', { name: 'Danh sách' }))
  expect(view.getAllByTestId('place-card-skeleton').length).toBeGreaterThan(0)
  expect(view.queryByTestId('loading-indicator')).toBeNull()
  expect(view.queryByTestId('search-loading-more')).toBeNull()
})
