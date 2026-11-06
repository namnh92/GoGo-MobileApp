import { act, fireEvent } from '@testing-library/react-native'

import { loaded as mockLoaded, renderScreen } from './harness'
import { scriptedTime } from './scripted-time'

/** Owner-approved group 02 discovery behaviour. */

const mockPush = jest.fn()
const mockBack = jest.fn()
const mockAddSeed = jest.fn()
let mockParams: Record<string, string> = {}
let mockScope = { status: 'ready', source: 'gps', position: { lat: 21, lng: 105 } }
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
  useSession: () => ({ status: 'user', session: null }),
}))
jest.mock('@/features/create-date/draft-resume.view', () => ({ DraftResume: () => null }))
jest.mock('@/shared/location/use-current-location', () => ({
  useCurrentLocation: () => ({ state: { status: 'idle' }, request: jest.fn() }),
}))
jest.mock('@/shared/location/use-discovery-scope', () => ({
  ...jest.requireActual('@/shared/location/use-discovery-scope'),
  useDiscoveryScope: () => ({ scope: mockScope, recheck: jest.fn() }),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useHomeRoom: () => mockLoaded(mockHomeRoom),
  useContributionCredits: () => mockLoaded(mockCredits),
  useDiscoveryPreview: (query: Record<string, unknown>, enabled: boolean) => { mockPreviewCalls.push({ query, enabled }); return mockPreview.value },
  useJoinRoom: () => ({ mutateAsync: jest.fn() }),
  useMe: () => mockLoaded({ homeAdministrativeArea: null }),
  useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: jest.fn() }),
  useAddRoomSeedPlaces: () => ({ mutate: mockAddSeed }),
  useTaxonomies: () =>
    mockLoaded({ kinds: { category: [{ key: 'cafe', labels: { vi: 'Cà phê', en: 'Cafe' } }], ...mockKinds } }),
  usePlaceSearch: (query: Record<string, unknown>) => { mockQueries.push(query); return mockSearch.value },
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
  mockKinds = {}
  mockHomeRoom = undefined
  mockCredits = undefined
  mockPreview.value = {}
  mockPreviewCalls.length = 0
  mockPush.mockClear()
  mockBack.mockClear()
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
    mockHomeRoom = { items: [{ id: 'nearest', title: 'Đi chơi', status: 'active', startAt: null, endAt: null }] }
    const view = await renderScreen(<HomeScreen />)
    expect(view.getByText('Đang diễn ra')).toBeTruthy()
    await fireEvent.press(view.getByText('Đi chơi'))
    expect(mockPush).toHaveBeenCalledWith('/room/nearest')
    mockHomeRoom = { items: [{ id: 'old', title: 'Old response', status: 'active' }] }
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
