import { act, fireEvent } from '@testing-library/react-native'

import { loaded as mockLoaded, renderScreen } from './harness'
import { scriptedTime } from './scripted-time'

/**
 * #382 (UI-AI-002 §7, §8) — Home greets by the time of day instead of always
 * saying "evening", and the search empty state is no longer a dead end: "Clear
 * filters" appears only when there is a filter to clear, and adding a place is
 * a button rather than a sentence that mentions Google Maps.
 */

const mockPush = jest.fn()
const mockSearch: { value: Record<string, unknown> } = { value: {} }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
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
  useDiscoveryScope: () => ({ scope: { status: 'resolving' }, recheck: jest.fn() }),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => mockLoaded({ homeAdministrativeArea: null }),
  useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: jest.fn() }),
  useAddRoomSeedPlaces: () => ({ mutate: jest.fn() }),
  useTaxonomies: () =>
    mockLoaded({ kinds: { category: [{ key: 'cafe', labels: { vi: 'Cà phê', en: 'Cafe' } }] } }),
  usePlaceSearch: () => mockSearch.value,
}))

import HomeScreen from '@/features/home/home.view'
import SearchScreen from '@/features/search/search.view'

function emptyPage() {
  return {
    data: { pages: [{ results: [], nextCursor: null, meta: {} }] },
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
  mockPush.mockClear()
  mockSearch.value = emptyPage()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('Home greeting (#382)', () => {
  it.each([
    [8, 'Chào buổi sáng'],
    [15, 'Chào buổi chiều'],
    [21, 'Chào buổi tối'],
    [2, 'Chào buổi tối'],
  ])('at %i:00 says "%s", with no emoji', async (hour, greeting) => {
    jest.spyOn(Date.prototype, 'getHours').mockReturnValue(hour)
    const view = await renderScreen(<HomeScreen />)
    expect(view.getByText(greeting)).toBeTruthy()
  })
})

describe('search empty state (#382)', () => {
  it('without a filter: no "Clear filters", and an "Add place" button that opens the import flow', async () => {
    const view = await renderScreen(<SearchScreen />)
    expect(view.getByText('Không tìm thấy địa điểm nào')).toBeTruthy()
    expect(view.queryByText('Xóa lọc')).toBeNull()

    const add = view.getByText('Thêm địa điểm')
    await act(async () => {
      await fireEvent.press(add)
    })
    expect(mockPush).toHaveBeenCalledWith('/places/import')
  })

  it('with a filter: "Clear filters" is offered and clears it', async () => {
    const view = await renderScreen(<SearchScreen />)
    await act(async () => {
      await fireEvent.press(view.getByText('Cà phê'))
    })
    const clear = view.getByText('Xóa lọc')
    await act(async () => {
      await fireEvent.press(clear)
    })
    expect(view.queryByText('Xóa lọc')).toBeNull()
  })
})
