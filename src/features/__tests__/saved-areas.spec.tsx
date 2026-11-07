import i18n from '@/shared/i18n'
import { useAppAreaStore } from '@/shared/location/app-area'
import { act, fireEvent } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { loaded, loaded as mockLoaded, renderScreen, type QueryLike } from './harness'

/**
 * ADM-205 / g04 — Saved groups places by province and
 * commune with the user's area first, and keeps unknown areas visible.
 */

const mockPush = jest.fn()
const originalOS = Platform.OS
const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockRoute = { provinceCode: '79', cityName: 'Thành phố Hồ Chí Minh' }
let mockCanGoBack = true
const mockMutate = jest.fn()
const mockSession = { status: 'user' as string }
const mockMe: { query: QueryLike } = { query: loaded({ homeAdministrativeArea: null }) }
const mockScope: { value: unknown } = { value: { status: 'ready', source: 'none', reason: 'no_area' } }
const mockLocated: { value: unknown } = { value: { data: undefined } }
const mockSaved: { value: unknown } = { value: { entries: [], isPending: false, isError: false, error: null, refetch: jest.fn() } }

jest.mock('expo-router', () => ({
  useFocusEffect: () => undefined,
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack, canGoBack: () => mockCanGoBack }),
  useLocalSearchParams: () => mockRoute,
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
    PlaceCard: ({ place, headerAction, footer, onPress, saved, onToggleSave }: { place: { name: string }; headerAction: import('react').ReactNode; footer: import('react').ReactNode; onPress: () => void; saved: boolean; onToggleSave: () => void }) => React.createElement(View, null,
      React.createElement(Pressable, { onPress }, React.createElement(Text, null, place.name)), headerAction, footer, React.createElement(Pressable, { accessibilityRole: 'togglebutton', accessibilityLabel: 'Bỏ lưu', accessibilityState: { checked: saved }, onPress: onToggleSave })),
  }
})

jest.mock('@/shared/ui/header-notification-button.view', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  return { HeaderNotificationButton: (props: object) => React.createElement(View, props) }
})

import SavedScreen from '@/features/tabs/saved.view'
import SavedCityScreen from '@/app/saved/city/[provinceCode]'

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
  mockPush.mockClear()
  mockBack.mockClear()
  mockReplace.mockClear()
  mockCanGoBack = true
  mockRoute.provinceCode = '79'
  mockRoute.cityName = HCM[1]
  mockMutate.mockClear()
  mockSession.status = 'user'
  mockMe.query = mockLoaded({ homeAdministrativeArea: null })
  mockScope.value = { status: 'ready', source: 'none', reason: 'no_area' }
  mockLocated.value = { data: undefined }
  mockSaved.value = { entries: ENTRIES, isPending: false, isError: false, error: null, refetch: jest.fn() }
})

afterEach(() => { Platform.OS = originalOS })

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
    expect(view.getByText('Quán chưa rõ')).toBeTruthy()
    expect(view.queryByText('‹ Tất cả thành phố')).toBeNull()
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/saved/city/[provinceCode]', params: { provinceCode: '79', cityName: HCM[1] } })
    expect(view.getByText('Cà phê Hồ Gươm')).toBeTruthy()
  })

  it('includes every ward and unavailable saved place in the selected city', async () => {
    const secondWard = { ...ENTRIES[1], key: 'place:sg', id: 'sg', area: area(HCM[0], HCM[1], '26740', 'Phường Sài Gòn', 'commune'), place: { name: 'Cà phê Sài Gòn' } }
    const unavailable = { ...ENTRIES[1], key: 'place:gone', id: 'gone', place: undefined }
    mockSaved.value = { entries: [...ENTRIES, secondWard, unavailable], isPending: false, isError: false }
    const view = await renderScreen(<SavedCityScreen />)
    expect(view.getByText(HCM[1])).toBeTruthy()
    expect(headers(view)).toEqual(['Phường Bến Thành', 'Phường Sài Gòn'])
    expect(view.getByText('2')).toBeTruthy()
    expect(view.getByText('1')).toBeTruthy()
    expect(view.queryByText('Tất cả ›')).toBeNull()
    expect(view.getByText('Chợ Bến Thành')).toBeTruthy()
    expect(view.getByText('Cà phê Sài Gòn')).toBeTruthy()
    expect(view.getByText('Địa điểm này không còn khả dụng')).toBeTruthy()
    expect(view.queryByText('Cà phê Hồ Gươm')).toBeNull()
    await press(view.getByText('Bỏ lưu'))
    expect(mockMutate).toHaveBeenCalledWith({ type: 'place', id: 'gone', saved: true }, expect.any(Object))
  })

  it('returns from the city screen using the standard back button', async () => {
    const view = await renderScreen(<SavedCityScreen />)
    expect(view.getByTestId('saved-city-bell')).toBeTruthy()
    await press(view.getByLabelText('Quay lại'))
    expect(mockBack).toHaveBeenCalledTimes(1)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('has a working back fallback on a direct city link', async () => {
    mockCanGoBack = false
    const view = await renderScreen(<SavedCityScreen />)
    await press(view.getByLabelText('Quay lại'))
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('opens city cards and keeps similar search on closed cards only', async () => {
    mockSaved.value = { entries: [{ ...ENTRIES[1], place: { name: 'Café', taxonomies: [{ kind: 'category', key: 'cafe' }] } }], isPending: false, isError: false }
    const view = await renderScreen(<SavedCityScreen />)
    await press(view.getByText('Café'))
    expect(mockPush).toHaveBeenCalledWith('/places/bt')
    expect(view.queryByText('Tìm quán tương tự')).toBeNull()
    expect(view.queryByLabelText('Thao tác địa điểm')).toBeNull()
    expect(view.queryByTestId('saved-actions-modal')).toBeNull()
  })

  it.each([SavedScreen, SavedCityScreen])('uses the filled bookmark for immediate removal and error feedback (%p)', async Screen => {
    mockSaved.value = { entries: [ENTRIES[1]], isPending: false, isError: false }
    const view = await renderScreen(<Screen />)
    const bookmark = view.getByRole('togglebutton', { name: 'Bỏ lưu' })
    expect(bookmark.props.accessibilityState.checked).toBe(true)
    expect(view.queryByText('⋮')).toBeNull()
    await press(bookmark)
    expect(mockMutate).toHaveBeenCalledTimes(1)
    expect(mockMutate).toHaveBeenCalledWith({ type: 'place', id: 'bt', saved: true }, expect.any(Object))
    await act(async () => { mockMutate.mock.calls[0][1].onError(new Error('offline')) })
    expect(view.getByText(i18n.t('saved.actionFailed'))).toBeTruthy()
  })

  it('renders the live city count, subtitle and working Saved navigation', async () => {
    const view = await renderScreen(<SavedCityScreen />)
    expect(view.getByText('1 địa điểm')).toBeTruthy()
    expect(view.getByText('Danh sách các địa điểm bạn đã lưu')).toBeTruthy()
    const selected = view.getByRole('tab', { name: i18n.t('tabs.saved') })
    expect(selected.props.accessibilityState.selected).toBe(true)
    await press(selected)
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/saved')
    await press(view.getByRole('tab', { name: i18n.t('tabs.plans') }))
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/plans')
  })

  it('shows a city-specific empty state even when another city has saved places', async () => {
    mockRoute.provinceCode = '48'
    mockRoute.cityName = 'Đà Nẵng'
    const view = await renderScreen(<SavedCityScreen />)
    expect(view.getByText('Đà Nẵng')).toBeTruthy()
    expect(view.getByText('Bạn chưa lưu địa điểm nào tại Đà Nẵng.')).toBeTruthy()
    expect(view.queryByText('Chợ Bến Thành')).toBeNull()
  })

  it('localizes the city empty state in English', async () => {
    await act(async () => { await i18n.changeLanguage('en') })
    try {
      mockSaved.value = { entries: [], isPending: false, isError: false }
      const view = await renderScreen(<SavedCityScreen />)
      expect(view.getByText('No saved places')).toBeTruthy()
      expect(view.getByText(`You haven’t saved any places in ${HCM[1]} yet.`)).toBeTruthy()
    } finally {
      await act(async () => { await i18n.changeLanguage('vi') })
    }
  })

  it('shows city loading placeholders with its title and back control', async () => {
    mockSaved.value = { entries: [], isPending: true, isError: false }
    const view = await renderScreen(<SavedCityScreen />)
    expect(view.getByText(HCM[1])).toBeTruthy()
    expect(view.getByLabelText('Quay lại')).toBeTruthy()
    expect(view.queryByTestId('saved-list')).toBeNull()
    expect(view.queryByText('Chưa có địa điểm đã lưu')).toBeNull()
  })

  it('shows a retryable city error', async () => {
    const refetch = jest.fn()
    mockSaved.value = { entries: [], isPending: false, isError: true, error: new Error('failed'), refetch }
    const view = await renderScreen(<SavedCityScreen />)
    await press(view.getByText('Thử lại'))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('shows the offline city state', async () => {
    mockSaved.value = { entries: [], isPaused: true, isPending: true, isError: false }
    const view = await renderScreen(<SavedCityScreen />)
    expect(view.getByText(i18n.t('common.offlineTitle'))).toBeTruthy()
    expect(view.queryByText('Chưa có địa điểm đã lưu')).toBeNull()
  })

  it('puts the located commune and its province first, then alphabetical, unknown last', async () => {
    mockScope.value = { status: 'ready', source: 'gps', position: { lat: 10.77, lng: 106.7 } }
    mockLocated.value = { data: { datasetVersion: 'ds-2026', area: area(HCM[0], HCM[1], '26734', 'Phường Bến Thành', 'commune') } }
    useAppAreaStore.setState({ area: { datasetVersion: 'ds-2026', provinceCode: HCM[0], provinceName: HCM[1], communeCode: '26734', communeName: 'Phường Bến Thành' } })
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

  it('uses the shared account fallback area when no position is located', async () => {
    useAppAreaStore.setState({ area: { datasetVersion: 'ds-2026', provinceCode: HN[0], provinceName: HN[1], communeCode: null, communeName: null } })
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

  it.each([SavedScreen, SavedCityScreen])('keeps standalone similar search scoped to a closed place category and area (%p)', async Screen => {
    mockSaved.value = { entries: [{ ...ENTRIES[1], place: { name: 'Closed café', providerStatus: { status: 'closed' }, taxonomies: [{ kind: 'category', key: 'cafe' }] } }], isPending: false, isError: false }
    const view = await renderScreen(<Screen />)
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
