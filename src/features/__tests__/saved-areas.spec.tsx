import { act, fireEvent } from '@testing-library/react-native'

import { loaded, loaded as mockLoaded, renderScreen, type QueryLike } from './harness'

/**
 * ADM-205 / g04 — Saved groups places by province and
 * commune with the user's area first, and keeps unknown areas visible.
 */

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
  const { Text, View, Pressable } = jest.requireActual<typeof import('react-native')>('react-native')
  return {
    PlaceCard: ({ place, headerAction, footer, onPress }: { place: { name: string }; headerAction: import('react').ReactNode; footer: import('react').ReactNode; onPress: () => void }) => React.createElement(View, null,
      React.createElement(Pressable, { onPress }, React.createElement(Text, null, place.name)), headerAction, footer),
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
  mockPush.mockClear()
  mockMutate.mockClear()
  mockSession.status = 'user'
  mockMe.query = mockLoaded({ homeAdministrativeArea: null })
  mockScope.value = { status: 'ready', source: 'none', reason: 'no_area' }
  mockLocated.value = { data: undefined }
  mockSaved.value = { entries: ENTRIES, isPending: false, isError: false, error: null, refetch: jest.fn() }
})

describe('Saved by area', () => {
  it('offers city saved-place lists without maps', async () => {
    const view = await renderScreen(<SavedScreen />)
    expect(view.getByText('Chợ Bến Thành')).toBeTruthy()
    expect(view.queryByText('Bản đồ')).toBeNull()
    expect(view.queryByText('Danh sách')).toBeNull()
    expect(view.getAllByText('Tất cả ›')).toHaveLength(2)
    expect(view.queryByTestId('saved-group-map')).toBeNull()
    expect(view.getAllByText('1')).toHaveLength(5)
    expect(view.queryByText('(1)')).toBeNull()
    await press(view.getAllByText('Tất cả ›')[1]!)
    expect(view.getByText('Chợ Bến Thành')).toBeTruthy()
    expect(view.queryByText('Cà phê Hồ Gươm')).toBeNull()
    expect(view.queryByText('Quán chưa rõ')).toBeNull()
    expect(mockPush).not.toHaveBeenCalled()
    await press(view.getByText('‹ Tất cả thành phố'))
    expect(view.getByText('Cà phê Hồ Gươm')).toBeTruthy()
  })

  it('includes every ward and unavailable saved place in the selected city', async () => {
    const secondWard = { ...ENTRIES[1], key: 'place:sg', id: 'sg', area: area(HCM[0], HCM[1], '26740', 'Phường Sài Gòn', 'commune'), place: { name: 'Cà phê Sài Gòn' } }
    const unavailable = { ...ENTRIES[1], key: 'place:gone', id: 'gone', place: undefined }
    mockSaved.value = { entries: [...ENTRIES, secondWard, unavailable], isPending: false, isError: false }
    const view = await renderScreen(<SavedScreen />)
    await press(view.getAllByText('Tất cả ›')[1]!)
    expect(headers(view)).toEqual(['Thành phố Hồ Chí Minh', 'Phường Bến Thành', 'Phường Sài Gòn'])
    expect(view.getByText('Chợ Bến Thành')).toBeTruthy()
    expect(view.getByText('Cà phê Sài Gòn')).toBeTruthy()
    expect(view.getByText('Địa điểm này không còn khả dụng')).toBeTruthy()
    expect(view.queryByText('Cà phê Hồ Gươm')).toBeNull()
    await press(view.getByText('Bỏ lưu'))
    expect(mockMutate).toHaveBeenCalledWith({ type: 'place', id: 'gone', saved: true }, expect.any(Object))
  })

  it('puts the located commune and its province first, then alphabetical, unknown last', async () => {
    mockScope.value = { status: 'ready', source: 'gps', position: { lat: 10.77, lng: 106.7 } }
    mockLocated.value = { data: { datasetVersion: 'ds-2026', area: area(HCM[0], HCM[1], '26734', 'Phường Bến Thành', 'commune') } }
    const view = await renderScreen(<SavedScreen />)
    expect(headers(view)).toEqual([
      'Thành phố Hồ Chí Minh',
      'Phường Bến Thành',
      'Thành phố Hà Nội',
      'Phường Hoàn Kiếm',
      'Chưa xác định khu vực',
    ])
    expect(view.queryByText('Khu vực hiện tại')).toBeNull()
  })

  it('falls back to the account area when no position is located', async () => {
    mockMe.query = mockLoaded({
      homeAdministrativeArea: { datasetVersion: 'ds-2026', provinceCode: HN[0], provinceName: HN[1], communeCode: null, communeName: null, status: 'current' },
    })
    const view = await renderScreen(<SavedScreen />)
    expect(headers(view)[0]).toBe('Thành phố Hà Nội')
  })

  it('shows only places and removes the filter chips, plan warnings and actions', async () => {
    const view = await renderScreen(<SavedScreen />)
    for (const label of ['Tất cả', 'Địa điểm', 'Kế hoạch', 'Kế hoạch đã lưu', 'Đi ngay', 'Điều kiện đã đổi sau khi lập kế hoạch']) {
      expect(view.queryByText(label)).toBeNull()
    }
    expect(view.getByText('Chợ Bến Thành')).toBeTruthy()
  })

  it('shows the places empty state when only legacy plans are saved', async () => {
    mockSaved.value = { entries: [ENTRIES[2]], isPending: false, isError: false }
    const view = await renderScreen(<SavedScreen />)
    expect(view.getByText('Chưa lưu gì cả')).toBeTruthy()
    await press(view.getByText('Tìm địa điểm'))
    expect(mockPush).toHaveBeenCalledWith('/places/search')
  })

  it('offers only removal in the place overflow menu', async () => {
    mockSaved.value = { entries: [ENTRIES[1]], isPending: false, isError: false }
    const view = await renderScreen(<SavedScreen />)
    await press(view.getByLabelText('Thao tác địa điểm'))
    expect(view.getByText('Bỏ lưu')).toBeTruthy()
    expect(view.queryByText('Chia sẻ')).toBeNull()
    const dismiss = view.getByTestId('saved-actions-modal').props.onDismiss
    await press(view.getByText('Bỏ lưu'))
    await act(async () => { dismiss() })
    expect(mockMutate).toHaveBeenCalledWith({ type: 'place', id: 'bt', saved: true }, expect.any(Object))
  })

  it('without a position or account area marks nothing current and sorts alphabetically', async () => {
    const view = await renderScreen(<SavedScreen />)
    expect(headers(view)).toEqual([
      'Thành phố Hà Nội',
      'Phường Hoàn Kiếm',
      'Thành phố Hồ Chí Minh',
      'Phường Bến Thành',
      'Chưa xác định khu vực',
    ])
    expect(view.queryByText('Khu vực hiện tại')).toBeNull()
  })

  it('keeps a saved place whose details failed to load removable', async () => {
    const { place: _place, ...withoutDetails } = ENTRIES[1]!
    mockSaved.value = { entries: [withoutDetails], isPending: false, isError: false, error: null, refetch: jest.fn() }
    const view = await renderScreen(<SavedScreen />)
    expect(view.getByText('Địa điểm này không còn khả dụng')).toBeTruthy()
    await press(view.getByText('Bỏ lưu'))
    expect(mockMutate).toHaveBeenCalledWith({ type: 'place', id: 'bt', saved: true }, expect.any(Object))
  })

  it('keeps similar-place search scoped to a closed place category and area', async () => {
    mockSaved.value = { entries: [{ ...ENTRIES[1], place: { name: 'Closed café', providerStatus: { status: 'closed' }, taxonomies: [{ kind: 'category', key: 'cafe' }] } }], isPending: false, isError: false }
    const view = await renderScreen(<SavedScreen />)
    await press(view.getByText('Tìm quán tương tự'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/places/search', params: expect.objectContaining({ categories: 'cafe', suggestions: '1', suggestionScope: expect.stringContaining('26734') }) })
  })

  it('shows loading placeholders before places arrive', async () => {
    mockSaved.value = { entries: [], isPending: true, isError: false }
    const view = await renderScreen(<SavedScreen />)
    expect(view.queryByText('Chưa lưu gì cả')).toBeNull()
    expect(view.queryByTestId('saved-list')).toBeNull()
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
