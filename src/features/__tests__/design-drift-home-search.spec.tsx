import type { DiscoveryScope } from '@/shared/location/use-discovery-scope'
import { StyleSheet } from 'react-native'
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query'
import i18n from '@/shared/i18n'
import { act, fireEvent, waitFor } from '@testing-library/react-native'

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
let mockHomeRoom: unknown = undefined
let mockCredits: unknown = undefined
const mockSearch: { value: Record<string, unknown> } = { value: {} }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
  useLocalSearchParams: () => mockParams,
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: mockSessionStatus, session: null }),
}))
jest.mock('@/features/create-date/draft-resume.view', () => ({ DraftResume: () => null }))
jest.mock('@/shared/location/use-current-location', () => ({
  useCurrentLocation: () => ({ state: { status: 'idle' }, request: jest.fn() }),
}))
jest.mock('@/shared/location/use-discovery-scope', () => ({
  ...jest.requireActual('@/shared/location/use-discovery-scope'),
  useDiscoveryScope: () => ({ scope: mockScope, recheck: jest.fn(), retry: mockRetryScope }),
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
  mockRealSearch = false
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
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/places/search', params: { moods: 'cozy' } })
    await fireEvent.press(view.getByLabelText('Ấm cúng'))
    expect(mockQueries.at(-1)?.moods).toBeUndefined()
  })
  it('renders the server-selected Home room and canonical link only with new schedule facts', async () => {
    mockHomeRoom = { items: [{ id: 'nearest', title: '  Đi chơi  ', type: 'group', participantCount: 4, status: 'active', startAt: null, endAt: null }] }
    const view = await renderScreen(<HomeScreen />)
    expect(view.getByText('Đang diễn ra')).toBeTruthy()
    await fireEvent.press(view.getByText('Đi chơi'))
    expect(mockPush).toHaveBeenCalledWith('/room/nearest')
    mockHomeRoom = { items: [{ id: 'old', title: 'Old response', type: 'couple', participantCount: 2, status: 'active' }] }
    await view.rerender(<HomeScreen />)
    expect(view.queryByText('Old response')).toBeNull()
  })
  it('shows the approval reward when credits are supported, including a zero balance', async () => {
    const view = await renderScreen(<SearchScreen />)
    expect(view.queryByText('+50 credit GoGo AI sau khi được duyệt (1 tin nhắn = 1 credit)')).toBeNull()
    mockCredits = { creditBalance: 0 }
    await view.rerender(<SearchScreen />)
    expect(view.getByText('+50 credit GoGo AI sau khi được duyệt (1 tin nhắn = 1 credit)')).toBeTruthy()
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
        expect(view.getByText(locale === 'vi' ? 'Đã có kế hoạch' : 'Plan ready')).toBeTruthy()
        await fireEvent.press(view.getByText(expected))
        expect(mockPush).toHaveBeenLastCalledWith('/room/nearest')
      }
    }
  } finally { await act(async () => { await i18n.changeLanguage('vi') }) }
})
it.each(['completed', 'cancelled', 'expired', 'draft'])('omits an ineligible nearest room (%s)', async status => {
  mockHomeRoom = { items: [{ ...roomFacts, type: 'group', participantCount: 3, title: 'Excluded room', status }] }
  const view = await renderScreen(<HomeScreen />)
  expect(view.queryByText('Excluded room')).toBeNull()
})

it.each(['count only', 'all taxonomy', 'selected entry'])('keeps Home mood removal, reset and See more after losing %s', async loss => {
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
  expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/places/search', params: { moods: 'cozy' } })
  await fireEvent.press(view.getByLabelText(label))
  expect(mockQueries.at(-1)?.moods).toBeUndefined()
  // Select again, then exercise the separate reset action.
  mockKinds = { mood: [{ key: 'cozy', labels: { vi: 'Ấm cúng' } }] }
  await view.rerender(<HomeScreen />)
  await fireEvent.press(view.getByLabelText('Ấm cúng'))
  mockKinds = {}
  await view.rerender(<HomeScreen />)
  await fireEvent.press(view.getByText('Tất cả'))
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
    expect(StyleSheet.flatten(view.getByTestId('open-now-options').props.style)).toMatchObject({ flexDirection: 'row' })
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
      await fireEvent.changeText(view.getByPlaceholderText(i18n.t('search.priceFrom')), '150')
      await fireEvent.changeText(view.getByPlaceholderText(i18n.t('search.priceTo')), '250')
      await fireEvent.press(view.getByText(i18n.t('discovery.apply')))
      expect(mockQueries.at(-1)).toMatchObject({ priceMinPerPerson: 150000, priceMaxPerPerson: 250000 })
    } finally {
      await act(async () => { await i18n.changeLanguage('vi') })
    }
  })

  it('pushes account above search and opens the public location route', async () => {
    const view = await renderScreen(<SearchScreen />)
    await fireEvent.changeText(view.getByLabelText('Tìm địa điểm'), 'retained query')
    await fireEvent.press(view.getByLabelText(i18n.t('profile.title')))
    expect(mockPush).toHaveBeenCalledWith('/settings/account')
    expect(view.getByLabelText('Tìm địa điểm').props.value).toBe('retained query')
    await fireEvent.press(view.getByLabelText(i18n.t('home.chooseArea')))
    expect(mockPush).toHaveBeenCalledWith('/places/location')
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
  expect(mockPush).toHaveBeenCalledWith('/places/location')
  expect(mockPush).not.toHaveBeenCalledWith('/auth/sign-in')
})
