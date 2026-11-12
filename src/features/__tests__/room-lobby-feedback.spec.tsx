import i18n from '@/shared/i18n'
import { act, fireEvent, screen, within } from '@testing-library/react-native'
import { QueryClient } from '@tanstack/react-query'
import { StyleSheet } from 'react-native'
import { loaded as mockLoaded, roomFor, type QueryLike } from './harness'
import { render } from '@/shared/ui/__tests__/query-render'
import { readPickerScope } from '@/shared/location/picker-scope'
import { touchTarget, type } from '@/shared/ui/tokens'
import { ThemeScopeProvider } from '@/shared/ui/scoped-theme'

jest.spyOn(jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles'), 'ScopedTheme').mockImplementation(({ children }) => <>{children}</>)

const mockArea = { datasetVersion: 'ds-2026', provinceCode: '01', provinceName: 'Thành phố Hà Nội', communeCode: '00004', communeName: 'Phường Ba Đình', status: 'current' as const }
const mockRoom: { query: QueryLike } = { query: mockLoaded(roomFor('group-host')) }
const mockPlaceDetail = jest.fn()
const mockPush = jest.fn()
const mockBack = jest.fn()
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useNavigation: () => ({ dispatch: jest.fn() }), usePreventRemove: jest.fn() }))
const mockRemoveSeed = jest.fn()
const mockPatch = jest.fn()
const mockRename = jest.fn()
const mockLocationRequest = jest.fn()
let mockFocus: (() => void) | undefined
let mockDatasetVersion = 'ds-2026'
jest.mock('@/shared/location/use-current-location', () => ({
  useCurrentLocation: () => ({ request: mockLocationRequest, state: { status: 'unavailable' } }),
}))
jest.mock('@/shared/navigation/deep-link', () => ({ ...jest.requireActual('@/shared/navigation/deep-link'), isUuid: () => true }))
jest.mock('expo-router', () => ({
  useNavigationContainerRef: () => ({ isReady: () => true }),
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: 'room-1' }),
  useFocusEffect: (callback: () => void) => { mockFocus = callback },
}))
jest.mock('@/shared/api/endpoints/rooms', () => ({
  ...jest.requireActual('@/shared/api/endpoints/rooms'),
  updateRoomConstraints: (...args: unknown[]) => mockPatch(...args),
  renameRoom: (...args: unknown[]) => mockRename(...args),
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user' }) }))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoomRealtime: () => ({ status: 'live' }),
  useCurrentSuggestions: () => mockLoaded(undefined),
  useCurrentPlan: () => mockLoaded(undefined),
  useRoom: () => mockRoom.query,
  useMyPreferences: () => mockLoaded({ selections: {}, version: 0 }),
  useSaveMyPreferences: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useSeedPlaceDetails: (seeds: { placeId: string }[]) => {
    const byPlaceId = new Map(seeds.map(seed => [seed.placeId, mockPlaceDetail(seed.placeId)]))
    return { byPlaceId, refetchAll: () => Promise.all([...byPlaceId.values()].map(detail => detail.refetch())) }
  },
  useTaxonomies: () => mockLoaded({ version: 1, kinds: { category: [{ key: 'cafe', labels: { vi: 'Cà phê', en: 'Cafe' } }] } }),
  useRoomInvites: () => mockLoaded([]),
  useRevokeRoomInvite: () => ({ mutate: jest.fn() }),
  useRemoveRoomMember: () => ({ mutate: jest.fn() }),
  useTransitionRoom: () => ({ mutate: jest.fn() }),
  useRemoveRoomSeedPlace: () => ({ mutate: mockRemoveSeed }),
}))
// Keep the real picker: version and unit data are the external boundary.
jest.mock('@/shared/administrative/queries', () => ({
  useAdministrativeVersion: () => mockLoaded({ datasetVersion: mockDatasetVersion }),
  useAdministrativeUnits: () => mockLoaded([{ code: '79', fullName: 'Thành phố Hồ Chí Minh' }]),
}))
import GoGoRoomScreen from '@/features/gogo-room/gogo-room.view'

let client: QueryClient
beforeEach(() => {
  // Seed FlatList batches cells on a timer; keep that work inside act under load.
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockPlaceDetail.mockReturnValue({ data: undefined, isPending: true, isError: false })
  mockDatasetVersion = 'ds-2026'
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })
  mockRoom.query = mockLoaded(roomFor('group-host', { constraintVersion: 7, constraints: { budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND', administrativeArea: mockArea }, seedPlaces: [{ placeId: 'seed-1', name: 'Quán thật' }] }))
  mockPatch.mockResolvedValue(roomFor('group-host', { constraintVersion: 8 }))
  mockRename.mockResolvedValue(roomFor('group-host', { title: 'Tên mới', constraintVersion: 7 }))
})
afterEach(async () => {
  try {
    await act(async () => { jest.runOnlyPendingTimers() })
  } finally {
    client.clear()
    jest.useRealTimers()
  }
})
async function press(node: Parameters<typeof fireEvent.press>[0]) { await act(async () => { await fireEvent.press(node) }) }
describe.each(['orange', 'orangeDark'] as const)('595 owner sim 3 / %s', theme => {
  it('uses the shared seed onRemove X and omits unknown facts', async () => {
    await render(<ThemeScopeProvider name={theme}><GoGoRoomScreen /></ThemeScopeProvider>, client)
    expect(screen.getByTestId('place-card-small')).toBeTruthy()
    expect(within(screen.getByTestId('place-card-small')).queryByText('Xoá')).toBeNull()
    expect(screen.queryByTestId('place-card-address')).toBeNull()
    expect(within(screen.getByTestId('place-card-small')).queryByText(/₫|Google/)).toBeNull()
    await press(screen.getByTestId('place-card-remove'))
    await press(within(screen.getByTestId('room-lobby-seed-confirm')).getByRole('button', { name: 'Xoá' }))
    expect(mockRemoveSeed).toHaveBeenCalledWith('seed-1', expect.any(Object))
  })
  it('opens a room-area picker with a compact title action and 44pt touch area', async () => {
    await render(<ThemeScopeProvider name={theme}><GoGoRoomScreen /></ThemeScopeProvider>, client)
    const add = screen.getByRole('button', { name: 'Thêm địa điểm gợi ý' })
    expect(within(add).queryByText('Thêm địa điểm gợi ý')).toBeNull()
    const size = StyleSheet.flatten(add.props.style)
    expect(size).toMatchObject({ width: 20, height: 20 })
    expect(size.height + add.props.hitSlop.top + add.props.hitSlop.bottom).toBe(touchTarget.min)
    expect(within(add.parent!).getByText('Địa điểm gợi ý')).toBeTruthy()
    await press(add)
    const href = mockPush.mock.calls[0][0]
    expect(href).toEqual({ pathname: '/places/search', params: { picker: '1', roomId: 'room-1', pickerScope: expect.any(String) } })
    expect(readPickerScope(href.params.pickerScope)).toEqual({ status: 'ready', source: 'selected_area', area: { ...mockArea, status: undefined } })
    expect(JSON.stringify(href)).not.toMatch(/provinceCode|originLat|originLng|position|latitude|longitude/)
    await press(add)
    expect(mockPush).toHaveBeenCalledTimes(1)
    await act(async () => { mockFocus?.() })
    await press(screen.getByRole('button', { name: 'Thêm địa điểm gợi ý' }))
    expect(mockPush).toHaveBeenCalledTimes(2)
    const id = mockPush.mock.calls[1][0].params.pickerScope
    await screen.unmount()
    expect(readPickerScope(id)).toBeNull()
  })
  it('uses lobby section headings and caption/body condition rows', async () => {
    await render(<ThemeScopeProvider name={theme}><GoGoRoomScreen /></ThemeScopeProvider>, client)
    for (const label of ['Điều kiện phòng', 'Địa điểm gợi ý', 'Thành viên']) {
      expect(StyleSheet.flatten(screen.getByText(label).props.style)).toMatchObject(type.discoveryHeading)
    }
    expect(StyleSheet.flatten(screen.getByText('Khu vực').props.style)).toMatchObject(type.caption)
    expect(StyleSheet.flatten(screen.getByText('Phường Ba Đình, Thành phố Hà Nội').props.style)).toMatchObject(type.body)
  })
})
it.each([null, { ...mockArea, status: 'needs_reselection' }])('requires a current area before opening seed search (%s)', async area => {
  mockRoom.query = mockLoaded(roomFor('group-host', { constraints: { budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND', administrativeArea: area as typeof mockArea | null } }))
  await render(<GoGoRoomScreen />, client)
  await press(screen.getByRole('button', { name: 'Thêm địa điểm gợi ý' }))
  expect(mockPush).not.toHaveBeenCalled()
  expect(screen.getByText('Hãy chọn khu vực của phòng để thêm địa điểm gợi ý.')).toBeTruthy()
})
it.each(['member', 'guest'] as const)('hides area editing for %s', async role => {
  mockRoom.query = mockLoaded(roomFor('group-guest', { members: [{ id: 'me', displayName: 'Tôi', role: 'member', isGuest: role === 'guest', selectionStatus: 'pending' }] }))
  await render(<GoGoRoomScreen />, client)
  expect(screen.queryByRole('button', { name: 'Sửa điều kiện phòng' })).toBeNull()
  expect(mockPatch).not.toHaveBeenCalled()
})
it('omits the danger heading, host permission card and inline warnings', async () => {
  await render(<GoGoRoomScreen />, client)
  for (const key of ['roomLobby.danger', 'roomManage.hostOnlyTitle', 'roomManage.hostOnlyBody', 'roomLobby.warning', 'roomManage.staleWarning']) {
    expect(screen.queryByText(i18n.t(key))).toBeNull()
  }
  expect(screen.getByRole('button', { name: 'Huỷ phòng' })).toBeTruthy()
  expect(screen.queryByText(i18n.t('roomManage.cancelBody'))).toBeNull()
  await press(screen.getByRole('button', { name: 'Sửa điều kiện phòng' }))
  expect(screen.queryByText(i18n.t('roomManage.staleWarning'))).toBeNull()
})
it.each(['vi', 'en'])('hydrates the lobby seed with protected rating facts in %s', async language => {
  await act(async () => { await i18n.changeLanguage(language) })
  try {
    mockPlaceDetail.mockReturnValue(mockLoaded({
      id: 'seed-1', name: 'Quán chi tiết', addressText: '12 Đường Hoa',
      photos: [{ url: 'https://example.com/seed.jpg', source: 'manual' }],
      rating: 4.7, ratingCount: 123, gogoRatingCount: 0,
      taxonomies: [{ kind: 'category', key: 'cafe' }],
      prices: [{ priceMin: 50000, priceMax: 80000, currency: 'VND', unit: 'per_person', confidence: 1 }],
    }))
    await render(<GoGoRoomScreen />, client)
    expect(mockPlaceDetail).toHaveBeenCalledWith('seed-1')
    expect(screen.getByTestId('place-card-name')).toHaveTextContent('Quán chi tiết')
    expect(screen.getByTestId('place-card-meta')).toHaveTextContent('12 Đường Hoa')
    expect(screen.getByTestId('place-google-rating')).toHaveTextContent(language === 'vi' ? '★ 4,7 (123) Google' : '★ 4.7 (123) Google')
    expect(screen.getByTestId('place-gogo-rating')).toHaveTextContent(language === 'vi' ? 'GoGo · 0 đánh giá' : 'GoGo · 0 reviews')
    for (const id of ['place-gogo-rating-count', 'place-gogo-rating-source', 'place-google-rating-count', 'place-google-rating-source']) {
      const fact = screen.getByTestId(id)
      expect(fact.props.numberOfLines).toBeUndefined()
      expect(fact.props.ellipsizeMode).toBeUndefined()
      expect(StyleSheet.flatten(fact.props.style).flexShrink).toBe(0)
    }
    expect(screen.getByTestId('place-photo-image').props).toMatchObject({
      source: [{ uri: 'https://example.com/seed.jpg', cacheKey: 'https://example.com/seed.jpg' }], cachePolicy: 'memory-disk',
    })
    await press(screen.getByTestId('place-card-remove'))
    await press(within(screen.getByTestId('room-lobby-seed-confirm')).getByRole('button', { name: i18n.t('roomManage.removeConfirm') }))
    expect(mockRemoveSeed).toHaveBeenCalledWith('seed-1', expect.any(Object))
  } finally { await act(async () => { await i18n.changeLanguage('vi') }) }
})
it.each(['loading', 'error'])('keeps a name-only removable seed on detail %s', async state => {
  mockPlaceDetail.mockReturnValue({ data: state === 'error' ? { id: 'seed-1', name: 'Stale detail', rating: 5, ratingCount: 10 } : undefined, isPending: state === 'loading', isError: state === 'error' })
  await render(<GoGoRoomScreen />, client)
  expect(screen.getByTestId('place-card-name')).toHaveTextContent('Quán thật')
  for (const id of ['place-card-meta', 'place-google-rating', 'place-card-price', 'place-card-tags', 'place-photo-image']) {
    expect(screen.queryByTestId(id)).toBeNull()
  }
  await press(screen.getByTestId('place-card-remove'))
  await press(within(screen.getByTestId('room-lobby-seed-confirm')).getByRole('button', { name: 'Xoá' }))
  expect(mockRemoveSeed).toHaveBeenCalledWith('seed-1', expect.any(Object))
})
it.each(['vi', 'en'])('orders lobby facts and renders the overnight end date in %s', async language => {
  await act(async () => { await i18n.changeLanguage(language) })
  try {
    const startAt = new Date(2026, 10, 11, 23).toISOString()
    const endAt = new Date(2026, 10, 12, 1).toISOString()
    mockRoom.query = mockLoaded(roomFor('group-host', { title: 'Kèo thật', constraints: {
      budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND', administrativeArea: mockArea, startAt, endAt,
    } }))
    await render(<GoGoRoomScreen />, client)
    expect(screen.getAllByTestId(/^room-fact-/).map(node => node.props.testID)).toEqual([
      'room-fact-name', 'room-fact-area', 'room-fact-budget', 'room-fact-schedule',
    ])
    const start = new Date(startAt).toLocaleString(language, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const end = new Date(endAt).toLocaleString(language, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    expect(within(screen.getByTestId('room-fact-schedule')).getByText(`${start} – ${end}`)).toBeTruthy()
    await press(screen.getByRole('button', { name: i18n.t('roomLobby.editConditions') }))
    expect(mockPush).toHaveBeenCalledWith('/room/room-1/edit')
  } finally {
    await act(async () => { await i18n.changeLanguage('vi') })
  }
})
it('renders start alone when the lobby schedule has no end', async () => {
  const startAt = new Date(2026, 10, 11, 23).toISOString()
  mockRoom.query = mockLoaded(roomFor('group-host', { constraints: { budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND', administrativeArea: null, startAt } }))
  await render(<GoGoRoomScreen />, client)
  const schedule = within(screen.getByTestId('room-fact-schedule'))
  expect(schedule.getByText('23:00 11/11/2026')).toBeTruthy()
  expect(schedule.queryByText(/ – /)).toBeNull()
})
it('marks the host avatar and announces the role while showing only selection status', async () => {
  await render(<GoGoRoomScreen />, client)
  const host = screen.getByLabelText(/^Tôi, Chủ phòng,/)
  expect(within(host).getByTestId('avatar-host-badge')).toBeTruthy()
  expect(within(host).getByText('Chưa chọn')).toBeTruthy()
  const member = screen.getByLabelText(/^Người 1, Thành viên,/)
  expect(within(member).queryByTestId('avatar-host-badge')).toBeNull()
  expect(within(member).getByText('Chưa chọn')).toBeTruthy()
  expect(screen.getAllByTestId('avatar-host-badge')).toHaveLength(1)
  expect(screen.queryByText(/Chủ phòng ·/)).toBeNull()
  expect(screen.queryByText('Chủ phòng')).toBeNull()
  expect(within(member).getByRole('button', { name: 'Mời Người 1 ra khỏi phòng' })).toBeTruthy()
  expect(within(host).queryByRole('button', { name: /Mời .* ra khỏi phòng/ })).toBeNull()
})
it('offers a seed-detail retry without inventing facts or losing remove', async () => {
  const refetch = jest.fn()
  mockPlaceDetail.mockReturnValue({ isError: true, isFetching: false, isPending: false, refetch })
  await render(<GoGoRoomScreen />, client)
  expect(screen.queryByTestId('place-card-meta')).toBeNull()
  await press(screen.getByRole('button', { name: 'Thử lại' }))
  expect(refetch).toHaveBeenCalledTimes(1)
  await press(screen.getByTestId('place-card-remove'))
  await press(within(screen.getByTestId('room-lobby-seed-confirm')).getByRole('button', { name: 'Xoá' }))
  expect(mockRemoveSeed).toHaveBeenCalledWith('seed-1', expect.any(Object))
})
it('shows compact skeleton facts while seed details fetch', async () => {
  mockPlaceDetail.mockReturnValue({ isPending: false, isFetching: true, isError: true })
  await render(<GoGoRoomScreen />, client)
  expect(screen.getByTestId('place-card-small-loading')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull()
  expect(screen.getByTestId('place-card-remove')).toBeTruthy()
})
it('pull-to-refresh refetches each current seed detail along with the room', async () => {
  const refetchOne = jest.fn()
  const refetchTwo = jest.fn()
  mockPlaceDetail.mockImplementation(placeId => ({
    isPending: false, isError: false,
    refetch: placeId === 'seed-1' ? refetchOne : refetchTwo,
  }))
  mockRoom.query = mockLoaded(roomFor('group-host', { seedPlaces: [
    { placeId: 'seed-1', name: 'One' }, { placeId: 'seed-2', name: 'Two' },
  ] }))
  await render(<GoGoRoomScreen />, client)
  await act(async () => { screen.getByTestId('room-lobby-scroll').props.refreshControl.props.onRefresh() })
  expect(refetchOne).toHaveBeenCalledTimes(1)
  expect(refetchTwo).toHaveBeenCalledTimes(1)
  expect(mockRoom.query.refetch).toHaveBeenCalledTimes(1)
})

it('round 6t: descriptions share bodySmall/secondary and a 12pt heading gap', async () => {
  await render(<GoGoRoomScreen />, client)
  const descriptions = ['members', 'seeds'].map(section => {
    const card = screen.getByTestId(`room-lobby-${section}`)
    expect(StyleSheet.flatten(card.props.style).gap).toBe(12)
    return within(card).getByText(section === 'members' ? /^Thành viên ·/ : 'GoGo sẽ ưu tiên đưa vào phương án.')
  })
  const styles = descriptions.map(node => StyleSheet.flatten(node.props.style))
  expect(styles[0]).toEqual(styles[1])
  expect(styles[0]).toMatchObject(type.bodySmall)
  const memberHeading = screen.getByText('Thành viên', { exact: true })
  const seedHeading = screen.getByText('Địa điểm gợi ý', { exact: true })
  const titleHeight = StyleSheet.flatten(seedHeading.props.style).lineHeight
  const addHeight = StyleSheet.flatten(screen.getByTestId('room-lobby-seeds-add').props.style).height
  expect(Math.max(titleHeight, addHeight)).toBe(StyleSheet.flatten(memberHeading.props.style).lineHeight)
})
it('round 6u: matching compact header icons retain accessible names and edit navigation', async () => {
  await render(<GoGoRoomScreen />, client)
  const edit = screen.getByRole('button', { name: 'Sửa điều kiện phòng' })
  const add = screen.getByRole('button', { name: 'Thêm địa điểm gợi ý' })
  expect(within(edit).queryAllByText(/Sửa/)).toHaveLength(0)
  for (const action of [edit, add]) {
    expect(StyleSheet.flatten(action.props.style)).toMatchObject({ width: 20, height: 20, borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' })
    expect(StyleSheet.flatten(action.props.style)).toMatchObject({ position: 'absolute', top: 16, right: 16 })
    expect(action.parent!.props.testID).toMatch(/^room-lobby-(conditions|seeds)$/)
    expect(action.props.hitSlop).toEqual({ top: 12, bottom: 12, left: 12, right: 12 })
  }
  expect(StyleSheet.flatten(edit.props.style)).toEqual(StyleSheet.flatten(add.props.style))
  for (const [action, icon] of [[edit, 'edit'], [add, 'plus']] as const) {
    expect(within(action).getByTestId(`material-icon-${icon}`, { includeHiddenElements: true }).props).toMatchObject({ width: 20, height: 20 })
  }
  await press(edit)
  expect(mockPush).toHaveBeenCalledWith('/room/room-1/edit')
})
