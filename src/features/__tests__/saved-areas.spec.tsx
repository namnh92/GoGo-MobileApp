import { useAppAreaStore } from '@/shared/location/app-area'
import { act, fireEvent } from '@testing-library/react-native'

import { loaded, loaded as mockLoaded, renderScreen, type QueryLike } from './harness'

/**
 * ADM-205 / g04 — Saved groups places and plans by province and
 * commune with the user's area first, and keeps unknown areas visible.
 */

let mockRoomData: unknown
let mockDetails: Record<string, unknown> = {}
const mockPush = jest.fn()
const mockMutate = jest.fn()
const mockSession = { status: 'user' as string }
const mockMe: { query: QueryLike } = { query: loaded({ homeAdministrativeArea: null }) }
const mockScope: { value: unknown } = { value: { status: 'ready', source: 'none', reason: 'no_area' } }
const mockLocated: { value: unknown } = { value: { data: undefined } }
const mockSaved: { value: unknown } = { value: { entries: [], isPending: false, isError: false, error: null, refetch: jest.fn() } }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: mockSession.status, session: null }),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useMe: () => mockMe.query,
  useTaxonomies: () => ({ data: undefined }),
  usePlaceDetail: (id: string) => ({ data: mockDetails[id] }),
  useRoom: () => ({ data: mockRoomData }),
  useSaved: () => ({ data: [] }),
  useResolveGoogleMapsLink: () => ({}),
  useSavedEntries: () => mockSaved.value,
  useToggleSaved: () => ({ mutate: mockMutate }),
}))
jest.mock('@/shared/location/use-discovery-scope', () => ({
  ...jest.requireActual('@/shared/location/use-discovery-scope'),
  useDiscoveryScope: () => ({ scope: mockScope.value, recheck: jest.fn() }),
}))
jest.mock('@/shared/administrative/queries', () => ({
  ...jest.requireActual('@/shared/administrative/queries'),
  useLocatedArea: () => mockLocated.value,
}))
jest.mock('@/shared/ui/place-card.view', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native')
  return {
    PlaceCard: ({ place }: { place: { name: string } }) => React.createElement(Text, null, place.name),
  }
})

jest.mock('@/shared/ui/header-notification-button.view', () => ({ HeaderNotificationButton: () => null }))

import SavedScreen from '@/features/tabs/saved.view'

const area = (provinceCode: string | null, provinceName: string | null, communeCode: string | null, communeName: string | null, scope: string) => ({
  scope,
  datasetVersion: scope === 'unknown' ? null : 'ds-2026',
  provinceCode,
  provinceName,
  communeCode,
  communeName,
})
const HCM = ['79', 'Thành phố Hồ Chí Minh'] as const
const HN = ['01', 'Thành phố Hà Nội'] as const

const ENTRIES = [
  { key: 'place:hk', type: 'place', id: 'hk', area: area(HN[0], HN[1], '00070', 'Phường Hoàn Kiếm', 'commune'), place: { name: 'Cà phê Hồ Gươm' } },
  { key: 'place:bt', type: 'place', id: 'bt', area: area(HCM[0], HCM[1], '26734', 'Phường Bến Thành', 'commune'), place: { name: 'Chợ Bến Thành' } },
  { key: 'plan:walk', type: 'plan', id: 'walk', area: area(HCM[0], HCM[1], null, null, 'province'), conditionsChanged: true, plan: { id: 'walk', stops: [{}, {}], isStale: false } },
  { key: 'place:x', type: 'place', id: 'x', area: area(null, null, null, null, 'unknown'), place: { name: 'Quán chưa rõ' } },
]

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(element)
  })
}

const headers = (view: Awaited<ReturnType<typeof renderScreen>>) =>
  view.getAllByRole('header').map(node => {
    const children = node.props.children
    return Array.isArray(children) ? children.join('') : String(children)
  })

beforeEach(() => {
  useAppAreaStore.setState({ area: null })
  mockRoomData = undefined
  mockDetails = {}
  mockPush.mockClear()
  mockMutate.mockClear()
  mockSession.status = 'user'
  mockMe.query = mockLoaded({ homeAdministrativeArea: null })
  mockScope.value = { status: 'ready', source: 'none', reason: 'no_area' }
  mockLocated.value = { data: undefined }
  mockSaved.value = { entries: ENTRIES, isPending: false, isError: false, error: null, refetch: jest.fn() }
})

describe('Saved by area', () => {
  it('keeps the list primary and offers group maps', async () => {
    const view = await renderScreen(<SavedScreen />)
    expect(view.getByText('Chợ Bến Thành')).toBeTruthy()
    expect(view.queryByText('Bản đồ')).toBeNull()
    expect(view.queryByText('Danh sách')).toBeNull()
    expect(view.getAllByText('Xem cụm').length).toBeGreaterThan(0)
  })

  it('puts the located commune and its province first, then alphabetical, unknown last', async () => {
    mockScope.value = { status: 'ready', source: 'gps', position: { lat: 10.77, lng: 106.7 } }
    mockLocated.value = { data: { datasetVersion: 'ds-2026', area: area(HCM[0], HCM[1], '26734', 'Phường Bến Thành', 'commune') } }
    useAppAreaStore.setState({ area: { datasetVersion: 'ds-2026', provinceCode: HCM[0], provinceName: HCM[1], communeCode: '26734', communeName: 'Phường Bến Thành' } })
    const view = await renderScreen(<SavedScreen />)
    expect(headers(view)).toEqual([
      'Thành phố Hồ Chí Minh',
      'Phường Bến Thành',
      'Nhiều phường/xã',
      'Thành phố Hà Nội',
      'Phường Hoàn Kiếm',
      'Chưa xác định khu vực',
    ])
    expect(view.getAllByText('Khu vực hiện tại')).toHaveLength(2)
  })

  it('uses the shared account fallback area when no position is located', async () => {
    useAppAreaStore.setState({ area: { datasetVersion: 'ds-2026', provinceCode: HN[0], provinceName: HN[1], communeCode: null, communeName: null } })
    mockMe.query = mockLoaded({
      homeAdministrativeArea: { datasetVersion: 'ds-2026', provinceCode: HN[0], provinceName: HN[1], communeCode: null, communeName: null, status: 'current' },
    })
    const view = await renderScreen(<SavedScreen />)
    expect(headers(view)[0]).toBe('Thành phố Hà Nội')
  })

  it('shows saved plans with their warnings and filters places and plans apart', async () => {
    const view = await renderScreen(<SavedScreen />)
    expect(view.getByText('Kế hoạch đã lưu')).toBeTruthy()
    expect(view.getByText('2 điểm dừng')).toBeTruthy()
    expect(view.getByText(/Điều kiện đã đổi/)).toBeTruthy()

    await press(view.getByText(/Địa điểm \(3\)/))
    expect(view.queryByText('Kế hoạch đã lưu')).toBeNull()
    expect(view.getByText('Chợ Bến Thành')).toBeTruthy()

    await press(view.getByText(/Kế hoạch \(1\)/))
    expect(view.getByText('Kế hoạch đã lưu')).toBeTruthy()
    expect(view.queryByText('Chợ Bến Thành')).toBeNull()
  })

  it('removes a saved plan and opens it', async () => {
    mockSaved.value = { entries: [ENTRIES[2]], isPending: false, isError: false, error: null, refetch: jest.fn() }
    const view = await renderScreen(<SavedScreen />)
    await press(view.getByText('Đi ngay'))
    expect(mockPush).toHaveBeenCalledWith('/plans/walk/active')
    await press(view.getByText('Kế hoạch đã lưu'))
    expect(mockPush).toHaveBeenCalledWith('/plans/walk')
    await press(view.getByText('Bỏ lưu'))
    expect(mockMutate).toHaveBeenCalledWith({ type: 'plan', id: 'walk', saved: true }, expect.any(Object))
  })

  it('without a position or account area marks nothing current and sorts alphabetically', async () => {
    const view = await renderScreen(<SavedScreen />)
    expect(headers(view)).toEqual([
      'Thành phố Hà Nội',
      'Phường Hoàn Kiếm',
      'Thành phố Hồ Chí Minh',
      'Phường Bến Thành',
      'Nhiều phường/xã',
      'Chưa xác định khu vực',
    ])
    expect(view.queryByText('Khu vực hiện tại')).toBeNull()
  })

  it('uses the room name, real date, position-ordered first photo and stop times', async () => {
    mockRoomData = { title: 'Hẹn nhóm', scheduledDate: '2026-11-07T03:00:00Z' }
    mockDetails = { a: { id: 'a', name: 'First café', photos: [{ url: 'https://example.com/a.jpg', source: 'community' }] }, b: { id: 'b', name: 'Second café', photos: [{ url: 'https://example.com/b.jpg', source: 'community' }] } }
    mockSaved.value = { entries: [{ ...ENTRIES[2], plan: { roomId: 'room', stops: [{ placeId: 'b', position: 2, arriveAt: '2026-11-07T04:00:00Z' }, { placeId: 'a', position: 1, arriveAt: '2026-11-07T03:00:00Z' }] } }], isPending: false, isError: false }
    const view = await renderScreen(<SavedScreen />)
    expect(view.getByText('Hẹn nhóm · 07/11/2026')).toBeTruthy()
    expect(view.getByText('10:00')).toBeTruthy()
    expect(view.getByText('11:00')).toBeTruthy()
    const source = view.getByTestId('place-photo-image').props.source
    expect(Array.isArray(source) ? source[0].uri : source.uri).toBe('https://example.com/a.jpg')
    expect(view.queryByText('Lộ trình tối')).toBeNull()
  })

  it('keeps a saved place whose details failed to load removable', async () => {
    const { place: _place, ...withoutDetails } = ENTRIES[1]!
    mockSaved.value = { entries: [withoutDetails], isPending: false, isError: false, error: null, refetch: jest.fn() }
    const view = await renderScreen(<SavedScreen />)
    expect(view.getByText('Địa điểm này không còn khả dụng')).toBeTruthy()
    await press(view.getByText('Bỏ lưu'))
    expect(mockMutate).toHaveBeenCalledWith({ type: 'place', id: 'bt', saved: true }, expect.any(Object))
  })

  it('shows a retryable error when the saved list fails', async () => {
    const refetch = jest.fn()
    mockSaved.value = { entries: [], isPending: false, isError: true, error: new Error('offline'), refetch }
    const view = await renderScreen(<SavedScreen />)
    expect(view.queryByText('Chợ Bến Thành')).toBeNull()
    await press(view.getByText('Thử lại'))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('asks a signed-out visitor to sign in', async () => {
    mockSession.status = 'anonymous'
    const view = await renderScreen(<SavedScreen />)
    expect(view.getByText('Đăng nhập để lưu địa điểm')).toBeTruthy()
  })
})
