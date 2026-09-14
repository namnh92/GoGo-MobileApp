import { act, fireEvent } from '@testing-library/react-native'

import { loaded, loaded as mockLoaded, renderScreen, type QueryLike } from './harness'

/**
 * ADM-204 (#209) — Home searches in the scope it resolved, says which scope the
 * server applied, and offers an honest way forward when there is none.
 */

const mockPush = jest.fn()
const mockSession = { status: 'user' as string }
const mockMe: { query: QueryLike } = { query: loaded({ homeAdministrativeArea: null }) }
const mockScope: { value: unknown } = { value: { status: 'resolving' } }
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
  useDiscoveryScope: () => ({ scope: mockScope.value, recheck: mockRecheck }),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => mockMe.query,
  useSaved: () => mockLoaded([]),
  useToggleSaved: () => ({ mutate: jest.fn() }),
  usePlaceSearch: (query: Record<string, unknown>, options: { enabled?: boolean }) => {
    mockSearchCalls.push({ query, options })
    return mockSearch.value
  },
}))

import HomeScreen from '@/features/home/home.view'
import { ApiError } from '@/shared/api/errors'

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
    fireEvent.press(element)
  })
}

beforeEach(() => {
  mockPush.mockClear()
  mockRecheck.mockClear()
  mockRequest.mockClear()
  mockSearchCalls.length = 0
  mockSession.status = 'user'
  mockScope.value = { status: 'resolving' }
  mockSearch.value = page(undefined)
})

describe('Home discovery scope', () => {
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
    expect(view.getByText('Gần vị trí hiện tại của bạn')).toBeTruthy()
  })

  it('searches in the account area and names it from the server answer', async () => {
    mockScope.value = { status: 'ready', source: 'profile_area', area: AREA }
    mockSearch.value = page({ source: 'administrative_area', area: AREA })
    const view = await renderScreen(<HomeScreen />)
    const last = mockSearchCalls.at(-1)!
    expect(last.query).toMatchObject({ datasetVersion: 'ds-2026', provinceCode: '79', communeCode: '26734' })
    expect(last.query).not.toHaveProperty('lat')
    expect(view.getByText('Theo khu vực tài khoản: Phường Bến Thành, Thành phố Hồ Chí Minh')).toBeTruthy()
  })

  it('claims no scope when the server does not report one', async () => {
    mockScope.value = { status: 'ready', source: 'profile_area', area: AREA }
    mockSearch.value = page(undefined)
    const view = await renderScreen(<HomeScreen />)
    expect(view.getByText('Có thể bạn sẽ thích')).toBeTruthy()
    expect(view.queryByText(/Theo khu vực tài khoản/)).toBeNull()
  })

  it('offers location or an area when there is neither, and uses a granted fix', async () => {
    mockScope.value = { status: 'ready', source: 'none', reason: 'no_area' }
    mockSearch.value = page({ source: 'none' })
    const view = await renderScreen(<HomeScreen />)
    expect(view.getByText('Gợi ý chung, chưa theo vị trí')).toBeTruthy()
    await press(view.getByText('Chọn khu vực'))
    expect(mockPush).toHaveBeenCalledWith('/settings/account')
    await press(view.getByText('Dùng vị trí hiện tại'))
    expect(mockRequest).toHaveBeenCalledTimes(1)
    expect(mockRecheck).toHaveBeenCalledTimes(1)
  })

  it('sends a guest to sign in to choose an area, and explains a replaced area', async () => {
    mockSession.status = 'guest'
    mockScope.value = { status: 'ready', source: 'none', reason: 'area_needs_reselection' }
    mockSearch.value = page({ source: 'none' })
    const view = await renderScreen(<HomeScreen />)
    expect(view.getByText(/cần chọn lại/)).toBeTruthy()
    await press(view.getByText('Chọn khu vực'))
    expect(mockPush).toHaveBeenCalledWith('/auth/sign-in')
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
    expect(mockPush).toHaveBeenCalledWith('/settings/account')
  })
})
