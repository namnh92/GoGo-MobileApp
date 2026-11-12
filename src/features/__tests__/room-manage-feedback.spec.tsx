import * as DialogModule from '@/shared/ui/dialog.view'
const mockDialog = jest.spyOn(DialogModule, 'Dialog')
import i18n from '@/shared/i18n'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { QueryClient } from '@tanstack/react-query'
import { StyleSheet } from 'react-native'
import { loaded as mockLoaded, roomFor, type QueryLike } from './harness'
import { render } from '@/shared/ui/__tests__/query-render'
import { queryKeys } from '@/shared/api/query-keys'
import { readPickerScope } from '@/shared/location/picker-scope'
import { touchTarget, type } from '@/shared/ui/tokens'
import { ThemeScopeProvider } from '@/shared/ui/scoped-theme'

jest.spyOn(jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles'), 'ScopedTheme').mockImplementation(({ children }) => <>{children}</>)

const mockArea = { datasetVersion: 'ds-2026', provinceCode: '01', provinceName: 'Thành phố Hà Nội', communeCode: '00004', communeName: 'Phường Ba Đình', status: 'current' as const }
const mockRoom: { query: QueryLike } = { query: mockLoaded(roomFor('group-host')) }
const mockPlaceDetail = jest.fn()
const mockPush = jest.fn()
const mockRemoveSeed = jest.fn()
const mockPatch = jest.fn()
const mockRename = jest.fn()
const mockLocationRequest = jest.fn()
let mockFocus: (() => void) | undefined
let mockDatasetVersion = 'ds-2026'
jest.mock('@/shared/location/use-current-location', () => ({
  useCurrentLocation: () => ({ request: mockLocationRequest }),
}))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: 'room-1' }),
  useFocusEffect: (callback: () => void) => { mockFocus = callback },
}))
jest.mock('@/shared/api/endpoints/rooms', () => ({
  ...jest.requireActual('@/shared/api/endpoints/rooms'),
  updateRoomConstraints: (...args: unknown[]) => mockPatch(...args),
  renameRoom: (...args: unknown[]) => mockRename(...args),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => mockRoom.query,
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
import RoomManageScreen from '@/features/gogo-room/room-manage.view'

let client: QueryClient
beforeEach(() => {
  jest.clearAllMocks()
  mockPlaceDetail.mockReturnValue({ data: undefined, isPending: true, isError: false })
  mockDatasetVersion = 'ds-2026'
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })
  mockRoom.query = mockLoaded(roomFor('group-host', { constraintVersion: 7, constraints: { budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND', administrativeArea: mockArea }, seedPlaces: [{ placeId: 'seed-1', name: 'Quán thật' }] }))
  mockPatch.mockResolvedValue(roomFor('group-host', { constraintVersion: 8 }))
  mockRename.mockResolvedValue(roomFor('group-host', { title: 'Tên mới', constraintVersion: 7 }))
})
afterEach(() => client.clear())
async function press(node: Parameters<typeof fireEvent.press>[0]) { await act(async () => { await fireEvent.press(node) }) }
async function openArea() {
  await render(<RoomManageScreen />, client)
  const edit = screen.getByRole('button', { name: 'Sửa' })
  expect(edit).toBeTruthy()
  await press(edit)
}
async function chooseArea() {
  await press(screen.getByRole('button', { name: 'Thành phố Hà Nội' }))
  expect(StyleSheet.flatten(screen.getByTestId('room-edit-body').props.style).flex).toBe(1)
  expect(StyleSheet.flatten(screen.getByTestId('room-manage-area-editor').props.style).flex).toBe(1)
  await press(screen.getByRole('button', { name: 'Thành phố Hồ Chí Minh' }))
}

describe.each(['orange', 'orangeDark'] as const)('595 owner sim 3 / %s', theme => {
  it('uses the shared seed onRemove X and omits unknown facts', async () => {
    await render(<ThemeScopeProvider name={theme}><RoomManageScreen /></ThemeScopeProvider>, client)
    expect(screen.getByTestId('place-card-small')).toBeTruthy()
    expect(within(screen.getByTestId('place-card-small')).queryByText('Xoá')).toBeNull()
    expect(screen.queryByTestId('place-card-address')).toBeNull()
    expect(within(screen.getByTestId('place-card-small')).queryByText(/₫|Google/)).toBeNull()
    await press(screen.getByTestId('place-card-remove'))
    expect(mockRemoveSeed).toHaveBeenCalledWith('seed-1')
  })
  it('opens a room-area picker with an icon-only 44pt add button in the title row', async () => {
    await render(<ThemeScopeProvider name={theme}><RoomManageScreen /></ThemeScopeProvider>, client)
    const add = screen.getByRole('button', { name: 'Thêm địa điểm gợi ý' })
    expect(within(add).queryByText('Thêm địa điểm gợi ý')).toBeNull()
    expect(StyleSheet.flatten(add.props.style)).toMatchObject({ width: touchTarget.min, height: touchTarget.min })
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
    await render(<ThemeScopeProvider name={theme}><RoomManageScreen /></ThemeScopeProvider>, client)
    for (const label of ['Điều kiện phòng', 'Địa điểm gợi ý', 'Thành viên']) {
      expect(StyleSheet.flatten(screen.getByText(label).props.style)).toMatchObject(type.discoveryHeading)
    }
    expect(StyleSheet.flatten(screen.getByText('Khu vực').props.style)).toMatchObject(type.caption)
    expect(StyleSheet.flatten(screen.getByText('Phường Ba Đình, Thành phố Hà Nội').props.style)).toMatchObject(type.body)
  })
})
it.each([null, { ...mockArea, status: 'needs_reselection' }])('requires a current area before opening seed search (%s)', async area => {
  mockRoom.query = mockLoaded(roomFor('group-host', { constraints: { budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND', administrativeArea: area as typeof mockArea | null } }))
  await render(<RoomManageScreen />, client)
  await press(screen.getByRole('button', { name: 'Thêm địa điểm gợi ý' }))
  expect(mockPush).not.toHaveBeenCalled()
  expect(screen.getByText('Hãy chọn khu vực của phòng để thêm địa điểm gợi ý.')).toBeTruthy()
})
it('saves area codes through the real mutation and marks suggestions/plan stale', async () => {
  client.setQueryData(queryKeys.roomSuggestions('room-1'), { run: 'old' })
  client.setQueryData(queryKeys.roomCurrentPlan('room-1'), { plan: 'old' })
  await openArea()
  expect(screen.getByRole('button', { name: 'Xác nhận' }).props.accessibilityState.disabled).toBe(true)
  await chooseArea()
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', {
    administrativeArea: { datasetVersion: 'ds-2026', provinceCode: '79', communeCode: null },
    originLat: null, originLng: null, radiusM: null,
    budgetMode: 'per_person', budgetAmount: 300000, expectedConstraintVersion: 7,
  }))
  expect(client.getQueryState(queryKeys.roomSuggestions('room-1'))?.isInvalidated).toBe(true)
  expect(client.getQueryState(queryKeys.roomCurrentPlan('room-1'))?.isInvalidated).toBe(true)
  expect(client.getQueryData(queryKeys.room('room-1'))).toMatchObject({ constraintVersion: 8 })
  expect(screen.getAllByText('✓ Đã lưu · gợi ý và kế hoạch cần tạo lại').length).toBeGreaterThan(0)
})
it('clears the GPS origin and radius when switching a Hanoi GPS room to a manual area', async () => {
  // Coordinates model stored GPS state; RoomSummary normally omits them for privacy.
  const gpsConstraints = {
    budgetMode: 'per_person' as const, budgetAmount: 300000, currency: 'VND',
    administrativeArea: mockArea, originLat: 21.0285, originLng: 105.8542, radiusM: 5000,
  }
  mockRoom.query = mockLoaded(roomFor('group-host', { constraintVersion: 7, constraints: gpsConstraints }))
  await openArea()
  await chooseArea()
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', {
    administrativeArea: { datasetVersion: 'ds-2026', provinceCode: '79', communeCode: null },
    originLat: null, originLng: null, radiusM: null,
    budgetMode: 'per_person', budgetAmount: 300000, expectedConstraintVersion: 7,
  }))
  expect(mockPatch).toHaveBeenCalledTimes(1)
})
it.each(['member', 'guest'] as const)('hides area editing for %s', async role => {
  mockRoom.query = mockLoaded(roomFor('group-guest', { members: [{ id: 'me', displayName: 'Tôi', role: 'member', isGuest: role === 'guest', selectionStatus: 'pending' }] }))
  await render(<RoomManageScreen />, client)
  expect(screen.queryByRole('button', { name: 'Sửa' })).toBeNull()
  expect(mockPatch).not.toHaveBeenCalled()
})
it('discards an unsaved area on cancel', async () => {
  await openArea()
  await chooseArea()
  await press(screen.getByRole('button', { name: 'Huỷ' }))
  expect(mockPatch).not.toHaveBeenCalled()
  expect(screen.getByText('Phường Ba Đình, Thành phố Hà Nội')).toBeTruthy()
})
it('blocks saving a selection from a replaced administrative dataset', async () => {
  await openArea()
  await chooseArea()
  mockDatasetVersion = 'ds-next'
  await screen.rerender(<RoomManageScreen />)
  expect(screen.getByRole('button', { name: 'Xác nhận' }).props.accessibilityState.disabled).toBe(true)
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  expect(mockPatch).not.toHaveBeenCalled()
})
it('blocks repeated submits and sheet dismissal until the area API resolves', async () => {
  let finish!: (value: ReturnType<typeof roomFor>) => void
  mockPatch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await openArea()
  await chooseArea()
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
  const modal = screen.getByTestId('room-edit-sheet-modal')
  expect(within(modal).getByTestId('blocking-loading-overlay')).toBeTruthy()
  await press(screen.getByText('Huỷ', { includeHiddenElements: true }))
  await act(async () => { await fireEvent(modal, 'requestClose') })
  expect(screen.getByTestId('room-edit-sheet')).toBeTruthy()
  expect(mockPatch).toHaveBeenCalledTimes(1)
  await act(async () => finish(roomFor('group-host', { constraintVersion: 8 })))
  await press(screen.getByRole('button', { name: 'Huỷ' }))
  expect(screen.queryByTestId('room-edit-sheet')).toBeNull()
})
it.each([409, 400])('keeps the draft and reports API %s without claiming success', async status => {
  const { ApiError } = jest.requireActual('@/shared/api/errors') as typeof import('@/shared/api/errors')
  mockPatch.mockRejectedValue(new ApiError(status, { code: 'TEST', message: 'rejected' }))
  await openArea()
  await chooseArea()
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() => expect(mockPatch).toHaveBeenCalled())
  expect(screen.getByText('Thành phố Hồ Chí Minh')).toBeTruthy()
  await waitFor(() => expect(screen.getByText(status === 409 ? 'Khu vực: Người khác vừa sửa điều kiện. Tải lại rồi thử lại nhé.' : 'Khu vực: Chưa lưu được. Thử lại nhé.')).toBeTruthy())
})

it('omits the danger heading, host permission card and inline warnings', async () => {
  await render(<RoomManageScreen />, client)
  for (const key of ['roomLobby.danger', 'roomManage.hostOnlyTitle', 'roomManage.hostOnlyBody', 'roomLobby.warning', 'roomManage.staleWarning']) {
    expect(screen.queryByText(i18n.t(key))).toBeNull()
  }
  expect(screen.getByRole('button', { name: 'Huỷ phòng' })).toBeTruthy()
  expect(screen.getByText(i18n.t('roomManage.cancelBody'))).toBeTruthy()
  await press(screen.getByRole('button', { name: 'Sửa' }))
  expect(screen.queryByText(i18n.t('roomManage.staleWarning'))).toBeNull()
})
it.each(['budget', 'area'])('confirms %s saves and preserves the sheet and draft on cancel', async editor => {
  if (editor === 'area') {
    await openArea()
    await chooseArea()
  } else {
    await render(<RoomManageScreen />, client)
    const edit = screen.getByRole('button', { name: 'Sửa' })
    await press(edit)
    await press(screen.getAllByRole('button').find(node => String(node.props.accessibilityLabel).includes('500'))!)
  }
  expect(screen.queryByText(i18n.t('roomManage.staleWarning'))).toBeNull()
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  expect(within(screen.getByTestId('room-edit-sheet-modal')).getByText('Đổi điều kiện phòng?')).toBeTruthy()
  expect(screen.getByText(i18n.t('roomManage.staleWarning'))).toBeTruthy()
  expect(mockPatch).not.toHaveBeenCalled()
  await press(screen.getAllByRole('button', { name: 'Huỷ' }).at(-1)!)
  expect(mockPatch).not.toHaveBeenCalled()
  expect(screen.getByTestId('room-edit-sheet')).toBeTruthy()
  expect(screen.queryByText(i18n.t('roomManage.staleWarning'))).toBeNull()
  expect(screen.getByRole('button', { name: 'Xác nhận' }).props.accessibilityState.disabled).toBe(false)
  if (editor === 'area') expect(screen.getByText('Thành phố Hồ Chí Minh')).toBeTruthy()
  else expect(screen.getAllByRole('button').find(node => String(node.props.accessibilityLabel).includes('500'))!.props.accessibilityState.selected).toBe(true)
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
  expect(mockPatch.mock.calls[0][1]).toMatchObject(editor === 'area'
    ? { administrativeArea: { provinceCode: '79' }, expectedConstraintVersion: 7 }
    : { budgetAmount: 500000, expectedConstraintVersion: 7 })
})

it('hydrates the common small seed card with detail photo, address and Google rating', async () => {
  mockPlaceDetail.mockReturnValue(mockLoaded({
    id: 'seed-1', name: 'Quán chi tiết', addressText: '12 Đường Hoa',
    photos: [{ url: 'https://example.com/seed.jpg', source: 'manual' }],
    rating: 4.7, ratingCount: 123,
    taxonomies: [{ kind: 'category', key: 'cafe' }],
    prices: [{ priceMin: 50000, priceMax: 80000, currency: 'VND', unit: 'per_person', confidence: 1 }],
  }))
  await render(<RoomManageScreen />, client)
  expect(mockPlaceDetail).toHaveBeenCalledWith('seed-1')
  expect(screen.getByTestId('place-card-name')).toHaveTextContent('Quán chi tiết')
  expect(screen.getByTestId('place-card-meta')).toHaveTextContent('12 Đường Hoa')
  expect(screen.getByTestId('place-google-rating')).toHaveTextContent('★ 4,7 (123) Google')
  expect(screen.getByTestId('place-photo-image').props).toMatchObject({
    source: [{ uri: 'https://example.com/seed.jpg', cacheKey: 'https://example.com/seed.jpg' }], cachePolicy: 'memory-disk',
  })
  await press(screen.getByTestId('place-card-remove'))
  expect(mockRemoveSeed).toHaveBeenCalledWith('seed-1')
})
it.each(['loading', 'error'])('keeps a name-only removable seed on detail %s', async state => {
  mockPlaceDetail.mockReturnValue({ data: state === 'error' ? { id: 'seed-1', name: 'Stale detail', rating: 5, ratingCount: 10 } : undefined, isPending: state === 'loading', isError: state === 'error' })
  await render(<RoomManageScreen />, client)
  expect(screen.getByTestId('place-card-name')).toHaveTextContent('Quán thật')
  for (const id of ['place-card-meta', 'place-google-rating', 'place-card-price', 'place-card-tags', 'place-photo-image']) {
    expect(screen.queryByTestId(id)).toBeNull()
  }
  await press(screen.getByTestId('place-card-remove'))
  expect(mockRemoveSeed).toHaveBeenCalledWith('seed-1')
})
it.each(['vi', 'en'])('orders manage facts and renders the overnight end date in %s', async language => {
  await act(async () => { await i18n.changeLanguage(language) })
  try {
    const startAt = new Date(2026, 10, 11, 23).toISOString()
    const endAt = new Date(2026, 10, 12, 1).toISOString()
    mockRoom.query = mockLoaded(roomFor('group-host', { constraints: {
      budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND', administrativeArea: mockArea, startAt, endAt,
    } }))
    await render(<RoomManageScreen />, client)
    expect(screen.getAllByTestId(/^room-fact-/).map(node => node.props.testID)).toEqual([
      'room-fact-name', 'room-fact-area', 'room-fact-budget', 'room-fact-schedule',
    ])
    const start = new Date(startAt).toLocaleString(language, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const end = new Date(endAt).toLocaleString(language, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    expect(within(screen.getByTestId('room-fact-schedule')).getByText(`${start} – ${end}`)).toBeTruthy()
    await press(screen.getByRole('button', { name: i18n.t('roomLobby.edit') }))
    expect(screen.getByLabelText(i18n.t('roomSchedule.start'))).toBeTruthy()
    expect(screen.getByTestId('room-title-field')).toBeTruthy()
    await press(screen.getByRole('button', { name: i18n.t('common.cancel') }))
    await press(screen.getByRole('button', { name: i18n.t('roomLobby.edit') }))
    expect(screen.getByTestId('room-title-field')).toBeTruthy()
    expect(screen.getByTestId('room-schedule-section')).toBeTruthy()
  } finally {
    await act(async () => { await i18n.changeLanguage('vi') })
  }
})
it('renders start alone when the manage schedule has no end', async () => {
  const startAt = new Date(2026, 10, 11, 23).toISOString()
  mockRoom.query = mockLoaded(roomFor('group-host', { constraints: { budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND', administrativeArea: null, startAt } }))
  await render(<RoomManageScreen />, client)
  const schedule = within(screen.getByTestId('room-fact-schedule'))
  expect(schedule.getByText('23:00 11/11/2026')).toBeTruthy()
  expect(schedule.queryByText(/ – /)).toBeNull()
})

it('marks the host avatar and announces the role while showing only selection status', async () => {
  await render(<RoomManageScreen />, client)
  const host = screen.getByLabelText(/^Tôi, Chủ phòng,/)
  expect(within(host).getByTestId('avatar-host-badge')).toBeTruthy()
  expect(within(host).getByText('Chưa chọn')).toBeTruthy()
  const member = screen.getByLabelText(/^Người 1, Thành viên,/)
  expect(within(member).queryByTestId('avatar-host-badge')).toBeNull()
  expect(within(member).getByText('Chưa chọn')).toBeTruthy()
  expect(screen.getAllByTestId('avatar-host-badge')).toHaveLength(1)
  expect(screen.queryByText(/Chủ phòng ·/)).toBeNull()
  expect(screen.queryByText('Chủ phòng')).toBeNull()
  expect(within(member).getByRole('button', { name: 'Xoá' })).toBeTruthy()
  expect(within(host).queryByRole('button', { name: 'Xoá' })).toBeNull()
})

it('offers a seed-detail retry without inventing facts or losing remove', async () => {
  const refetch = jest.fn()
  mockPlaceDetail.mockReturnValue({ isError: true, isFetching: false, isPending: false, refetch })
  await render(<RoomManageScreen />, client)
  expect(screen.queryByTestId('place-card-meta')).toBeNull()
  await press(screen.getByRole('button', { name: 'Thử lại' }))
  expect(refetch).toHaveBeenCalledTimes(1)
  await press(screen.getByTestId('place-card-remove'))
  expect(mockRemoveSeed).toHaveBeenCalledWith('seed-1')
})
it('shows compact skeleton facts while seed details fetch', async () => {
  mockPlaceDetail.mockReturnValue({ isPending: false, isFetching: true, isError: true })
  await render(<RoomManageScreen />, client)
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
  await render(<RoomManageScreen />, client)
  await act(async () => { screen.getByTestId('room-manage-scroll').props.refreshControl.props.onRefresh() })
  expect(refetchOne).toHaveBeenCalledTimes(1)
  expect(refetchTwo).toHaveBeenCalledTimes(1)
  expect(mockRoom.query.refetch).toHaveBeenCalledTimes(1)
})
it('uses a warning ResultSheet for area confirmation; cancel and dismiss keep the draft', async () => {
  await openArea()
  await chooseArea()
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  expect(screen.getByTestId('room-conditions-confirmation')).toBeTruthy()
  expect(mockDialog).not.toHaveBeenCalled()
  // Embedded ResultSheet reuses the editor Modal; it creates no second Modal.
  expect(screen.queryByTestId('room-conditions-confirmation-modal', { includeHiddenElements: true })).toBeNull()
  await press(screen.getByRole('button', { name: 'Huỷ' }))
  expect(mockPatch).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Xác nhận' }).props.accessibilityState.disabled).toBe(false)
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await act(async () => { await fireEvent(screen.getByTestId('room-edit-sheet-modal'), 'requestClose') })
  expect(mockPatch).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Xác nhận' }).props.accessibilityState.disabled).toBe(false)
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
})

it.each(['vi', 'en'])('uses the shared ResultSheet for budget changes in %s, saving only on confirm', async language => {
  await act(async () => { await i18n.changeLanguage(language) })
  try {
    await render(<RoomManageScreen />, client)
    await press(screen.getByRole('button', { name: i18n.t('roomLobby.edit') }))
    const tier = screen.getAllByRole('button').find(node => /500/.test(node.props.accessibilityLabel ?? ''))!
    expect(tier).toBeTruthy()
    await press(tier)
    await press(screen.getByRole('button', { name: i18n.t('roomEdit.saveSchedule') }))
    const confirmation = screen.getByTestId('room-conditions-confirmation')
    expect(within(confirmation).getByText(i18n.t('roomManage.staleWarning'))).toBeTruthy()
    expect(mockDialog).not.toHaveBeenCalled()
    const cancel = within(confirmation).getByRole('button', { name: i18n.t('common.cancel') })
    const confirm = within(confirmation).getByRole('button', { name: i18n.t('roomEdit.saveSchedule') })
    expect(cancel.parent).toBe(confirm.parent)
    expect(cancel.parent!.children.indexOf(cancel)).toBeLessThan(cancel.parent!.children.indexOf(confirm))
    await press(cancel)
    expect(mockPatch).not.toHaveBeenCalled()
    await press(screen.getByRole('button', { name: i18n.t('roomEdit.saveSchedule') }))
    await press(screen.getByRole('button', { name: i18n.t('roomEdit.saveSchedule') }))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
    expect(mockPatch).toHaveBeenCalledWith('room-1', expect.objectContaining({ budgetAmount: 500000 }))
  } finally { await act(async () => { await i18n.changeLanguage('vi') }) }
})


async function typeField(label: string, value: string) {
  await act(async () => { await fireEvent.changeText(screen.getByLabelText(label), value) })
}
async function confirmEditor() {
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
}
async function chooseBudget() {
  await press(screen.getAllByRole('button').find(node => /500/.test(node.props.accessibilityLabel ?? ''))!)
}

it('has one header edit, no row edits, all fields prefilled and one disabled confirmation row', async () => {
  const startAt = new Date(2026, 10, 14, 19).toISOString()
  const endAt = new Date(2026, 10, 14, 22).toISOString()
  mockRoom.query = mockLoaded(roomFor('group-host', { title: 'Tên cũ', constraintVersion: 7, constraints: {
    budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND', administrativeArea: mockArea, startAt, endAt,
  } }))
  await render(<RoomManageScreen />, client)
  expect(screen.getAllByRole('button', { name: 'Sửa' })).toHaveLength(1)
  for (const row of screen.getAllByTestId(/^room-fact-/)) expect(within(row).queryByRole('button')).toBeNull()
  await press(screen.getByRole('button', { name: 'Sửa' }))
  expect(screen.getByText('Chỉnh sửa kèo')).toBeTruthy()
  expect(screen.getByLabelText('Tên kèo').props.value).toBe('Tên cũ')
  expect(screen.getByText('6/80')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Thành phố Hà Nội' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Phường Ba Đình' })).toBeTruthy()
  expect(screen.getByLabelText('Bắt đầu').props.value).toBe('14/11/2026 19:00')
  expect(screen.getByLabelText('Kết thúc (không bắt buộc)').props.value).toBe('14/11/2026 22:00')
  expect(screen.getAllByRole('button').find(node => /300/.test(node.props.accessibilityLabel ?? ''))!.props.accessibilityState.selected).toBe(true)
  const confirm = screen.getByRole('button', { name: 'Xác nhận' })
  const cancel = screen.getByRole('button', { name: 'Huỷ' })
  expect(confirm.props.accessibilityState.disabled).toBe(true)
  expect(cancel.parent).toBe(confirm.parent)
  expect(cancel.parent!.children.indexOf(cancel)).toBeLessThan(cancel.parent!.children.indexOf(confirm))
  expect(screen.queryByText('Lưu tên')).toBeNull()
  await confirmEditor()
  expect(mockRename).not.toHaveBeenCalled()
  expect(mockPatch).not.toHaveBeenCalled()
})

it.each(['  Tên mới  ', '   '])('title-only saves trimmed/null title without a constraint request or stale confirmation (%s)', async title => {
  await openArea()
  await typeField('Tên kèo', title)
  // Empty is a change only when the original room had a title.
  if (!title.trim()) {
    await press(screen.getByRole('button', { name: 'Huỷ' }))
    mockRoom.query = mockLoaded(roomFor('group-host', { title: 'Tên cũ' }))
    await screen.rerender(<RoomManageScreen />)
    await press(screen.getByRole('button', { name: 'Sửa' }))
    await typeField('Tên kèo', title)
  }
  await confirmEditor()
  await waitFor(() => expect(mockRename).toHaveBeenCalledWith('room-1', { title: title.trim() || null }))
  expect(mockPatch).not.toHaveBeenCalled()
  expect(screen.queryByTestId('room-conditions-confirmation')).toBeNull()
  expect(screen.getByRole('button', { name: 'Xác nhận' }).props.accessibilityState.disabled).toBe(true)
})

it('F-12 omits unchanged currency for a budget-only change', async () => {
  await openArea()
  await chooseBudget()
  await confirmEditor()
  expect(mockPatch).not.toHaveBeenCalled()
  expect(screen.getByTestId('room-conditions-confirmation')).toBeTruthy()
  await confirmEditor()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', {
    budgetAmount: 500000, budgetMode: 'per_person', expectedConstraintVersion: 7,
  }))
  expect(mockRename).not.toHaveBeenCalled()
})

it('combines only changed area and schedule fields in one constraints request', async () => {
  await openArea()
  await chooseArea()
  await typeField('Bắt đầu', '14/11/2026 19:00')
  await typeField('Kết thúc (không bắt buộc)', '14/11/2026 22:00')
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', {
    administrativeArea: { datasetVersion: 'ds-2026', provinceCode: '79', communeCode: null },
    originLat: null, originLng: null, radiusM: null,
    startAt: new Date(2026, 10, 14, 19).toISOString(), endAt: new Date(2026, 10, 14, 22).toISOString(),
    budgetMode: 'per_person', budgetAmount: 300000, expectedConstraintVersion: 7,
  }))
  expect(mockPatch).toHaveBeenCalledTimes(1)
  expect(mockRename).not.toHaveBeenCalled()
})

it('keeps the failed constraints draft and does not resend the successful title on retry', async () => {
  mockPatch.mockRejectedValueOnce(new Error('offline'))
  await openArea()
  await typeField('Tên kèo', 'Tên mới')
  await chooseBudget()
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(screen.getByText('Ngân sách: Chưa lưu được. Thử lại nhé.')).toBeTruthy())
  expect(screen.getByTestId('room-edit-sheet')).toBeTruthy()
  expect(mockRename).toHaveBeenCalledTimes(1)
  expect(mockPatch).toHaveBeenCalledTimes(1)
  expect(mockRename.mock.invocationCallOrder[0]).toBeLessThan(mockPatch.mock.invocationCallOrder[0])
  expect(screen.getByLabelText('Tên kèo').props.value).toBe('Tên mới')
  expect(screen.getAllByRole('button').find(node => /500/.test(node.props.accessibilityLabel ?? ''))!.props.accessibilityState.selected).toBe(true)
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2))
  expect(mockRename).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Xác nhận' }).props.accessibilityState.disabled).toBe(true)
})

it('stops the sequence on title failure and retries the still-dirty parts', async () => {
  mockRename.mockRejectedValueOnce(new Error('offline'))
  await openArea()
  await typeField('Tên kèo', 'Tên mới')
  await chooseBudget()
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(screen.getByText('Tên kèo: Chưa lưu được. Thử lại nhé.')).toBeTruthy())
  expect(mockPatch).not.toHaveBeenCalled()
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
  expect(mockRename).toHaveBeenCalledTimes(2)
})

it('disables confirmation for invalid schedule/title and for reverted changes', async () => {
  await openArea()
  await typeField('Tên kèo', 'a'.repeat(81))
  expect(screen.getByRole('button', { name: 'Xác nhận' }).props.accessibilityState.disabled).toBe(true)
  await typeField('Tên kèo', '')
  await typeField('Bắt đầu', '31/02/2026 19:00')
  expect(screen.getByRole('button', { name: 'Xác nhận' }).props.accessibilityState.disabled).toBe(true)
  await typeField('Bắt đầu', '')
  await chooseBudget()
  await press(screen.getAllByRole('button').find(node => /300/.test(node.props.accessibilityLabel ?? ''))!)
  expect(screen.getByRole('button', { name: 'Xác nhận' }).props.accessibilityState.disabled).toBe(true)
  expect(mockPatch).not.toHaveBeenCalled()
})

it('clears only an edited end and preserves the start and GPS fields by omission', async () => {
  mockRoom.query = mockLoaded(roomFor('group-host', { constraintVersion: 7, constraints: {
    budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND', administrativeArea: null,
    startAt: new Date(2026, 10, 14, 19, 0, 30).toISOString(), endAt: new Date(2026, 10, 14, 22).toISOString(),
  } }))
  await openArea()
  await typeField('Kết thúc (không bắt buộc)', '')
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', {
    endAt: null, budgetMode: 'per_person', budgetAmount: 300000, expectedConstraintVersion: 7,
  }))
})


it('preserves all typed fields across the full-height area chooser', async () => {
  await openArea()
  await typeField('Tên kèo', 'Tên mới')
  await chooseBudget()
  await typeField('Bắt đầu', '14/11/2026 19:00')
  await chooseArea()
  expect(screen.getByLabelText('Tên kèo').props.value).toBe('Tên mới')
  expect(screen.getByLabelText('Bắt đầu').props.value).toBe('14/11/2026 19:00')
  expect(screen.getAllByRole('button').find(node => /500/.test(node.props.accessibilityLabel ?? ''))!.props.accessibilityState.selected).toBe(true)
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
  expect(mockRename).toHaveBeenCalledTimes(1)
  expect(mockPatch.mock.calls[0][1]).toEqual({
    budgetMode: 'per_person', budgetAmount: 500000, expectedConstraintVersion: 7,
    administrativeArea: { datasetVersion: 'ds-2026', provinceCode: '79', communeCode: null },
    originLat: null, originLng: null, radiusM: null, startAt: new Date(2026, 10, 14, 19).toISOString(),
  })
})

it('F-12 omits unchanged currency when editing the group size and budget mode', async () => {
  await openArea()
  await press(screen.getByRole('button', { name: i18n.t('groupSetup.increase') }))
  await press(screen.getByRole('button', { name: i18n.t('groupSetup.groupTotal') }))
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', {
    budgetMode: 'total', budgetAmount: 300000, participantCount: 5, expectedConstraintVersion: 7,
  }))
})

it('changes only the existing GPS distance and leaves the undisclosed origin untouched', async () => {
  mockRoom.query = mockLoaded(roomFor('group-host', { constraintVersion: 7, constraints: {
    budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND', administrativeArea: null, radiusM: 5000,
  } }))
  await openArea()
  await press(screen.getByRole('button', { name: '10 km' }))
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', {
    budgetMode: 'per_person', budgetAmount: 300000, radiusM: 10000, expectedConstraintVersion: 7,
  }))
})

it('stages a GPS replacement until confirmation, then atomically replaces the manual area', async () => {
  mockLocationRequest.mockResolvedValueOnce({ status: 'granted', lat: 10.77, lng: 106.7, label: 'Vị trí hiện tại' })
  await openArea()
  await press(screen.getByRole('button', { name: i18n.t('home.useLocation') }))
  expect(mockPatch).not.toHaveBeenCalled()
  expect(screen.getByText('Vị trí hiện tại')).toBeTruthy()
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', {
    budgetMode: 'per_person', budgetAmount: 300000, expectedConstraintVersion: 7,
    administrativeArea: null, originLat: 10.77, originLng: 106.7, radiusM: 5000,
  }))
})

it('keeps the manual area and permits title-only saving when location is denied', async () => {
  mockLocationRequest.mockResolvedValueOnce({ status: 'denied' })
  await openArea()
  await press(screen.getByRole('button', { name: i18n.t('home.useLocation') }))
  expect(screen.getByText(i18n.t('createLocation.permissionDenied'))).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Thành phố Hà Nội' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Xác nhận' }).props.accessibilityState.disabled).toBe(true)
  await typeField('Tên kèo', 'Tên mới')
  await confirmEditor()
  await waitFor(() => expect(mockRename).toHaveBeenCalledTimes(1))
  expect(mockPatch).not.toHaveBeenCalled()
})

it('uses the returned constraint version for a second edit in the same open sheet', async () => {
  await openArea()
  await chooseBudget()
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Xác nhận' }).props.accessibilityState.disabled).toBe(true))
  await press(screen.getAllByRole('button').find(node => /300/.test(node.props.accessibilityLabel ?? ''))!)
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2))
  expect(mockPatch.mock.calls[1][1]).toEqual({ budgetMode: 'per_person', budgetAmount: 300000, expectedConstraintVersion: 8 })
})

it.each(['active', 'completed', 'cancelled'] as const)('keeps the unified editor locked in %s', async status => {
  mockRoom.query = mockLoaded(roomFor('group-host', { status }))
  await openArea()
  expect(screen.getByLabelText('Tên kèo').props.editable).toBe(false)
  expect(screen.getByLabelText('Bắt đầu').props.editable).toBe(false)
  expect(screen.getByRole('button', { name: 'Xác nhận' }).props.accessibilityState.disabled).toBe(true)
  expect(screen.getByText(i18n.t('roomTitle.locked'))).toBeTruthy()
  expect(mockRename).not.toHaveBeenCalled()
  expect(mockPatch).not.toHaveBeenCalled()
})

it.each(['vi', 'en'])('keeps compact aligned schedule fields in %s', async language => {
  await act(async () => { await i18n.changeLanguage(language) })
  try {
    await render(<RoomManageScreen />, client)
    await press(screen.getByRole('button', { name: i18n.t('roomLobby.edit') }))
    for (const name of ['start', 'end']) {
      const column = screen.getByTestId(`room-schedule-${name}`)
      const label = within(column).getByText(i18n.t(name === 'end' ? 'roomSchedule.endShort' : 'roomSchedule.start'))
      expect(label.props.numberOfLines).toBe(1)
      expect(StyleSheet.flatten(label.props.style).height).toBe(type.label.lineHeight)
      expect(StyleSheet.flatten(column.props.style)).toMatchObject({ flex: 1, minWidth: 0 })
      expect(column.children[0]).toBe(label)
    }
  } finally { await act(async () => { await i18n.changeLanguage('vi') }) }
})


it.each([500000, 100000])('F-10 reloads explicitly after conflict and reconciles a draft against server budget %s', async budgetAmount => {
  const { ApiError } = jest.requireActual('@/shared/api/errors') as typeof import('@/shared/api/errors')
  mockPatch.mockRejectedValueOnce(new ApiError(409, { code: 'CONSTRAINT_VERSION_CONFLICT', message: 'changed elsewhere' }))
  const startAt = new Date(2026, 10, 15, 20, 0, 30).toISOString()
  const fresh = roomFor('group-host', { title: 'Tên từ thiết bị khác', constraintVersion: 12, participantCount: 6, constraints: {
    budgetMode: 'total', budgetAmount, currency: 'VND', administrativeArea: mockArea, startAt,
  } })
  let finish!: (value: { data: typeof fresh, isError: boolean }) => void
  const refetch = jest.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  mockRoom.query.refetch = refetch
  await openArea()
  await chooseBudget()
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(screen.getByText(`Ngân sách: ${i18n.t('roomManage.conflict')}`)).toBeTruthy())
  expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
  // Background query updates alone must never advance the editor's version.
  mockRoom.query.data = fresh
  await screen.rerender(<RoomManageScreen />)
  expect(screen.getByLabelText('Tên kèo').props.value).toBe('')
  expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
  expect(mockPatch).toHaveBeenCalledTimes(1)
  await press(screen.getByRole('button', { name: i18n.t('roomEdit.reload') }))
  expect(refetch).toHaveBeenCalledWith({ cancelRefetch: false })
  const modal = screen.getByTestId('room-edit-sheet-modal')
  expect(within(modal).getByTestId('blocking-loading-overlay')).toBeTruthy()
  await act(async () => { await fireEvent(modal, 'requestClose') })
  expect(screen.getByTestId('room-edit-sheet')).toBeTruthy()
  await act(async () => finish({ data: fresh, isError: false }))
  await waitFor(() => expect(screen.queryByRole('button', { name: i18n.t('roomEdit.reload') })).toBeNull())
  expect(screen.getByLabelText('Tên kèo').props.value).toBe('Tên từ thiết bị khác')
  expect(screen.getByLabelText('Bắt đầu').props.value).toBe('15/11/2026 20:00')
  expect(screen.getByText(i18n.t('groupSetup.people', { n: 6 }))).toBeTruthy()
  expect(screen.getAllByRole('button').find(node => /500/.test(node.props.accessibilityLabel ?? ''))!.props.accessibilityState.selected).toBe(true)
  expect(screen.getByRole('button', { name: 'Xác nhận' }).props.accessibilityState.disabled).toBe(budgetAmount === 500000)
  expect(mockPatch).toHaveBeenCalledTimes(1)
  if (budgetAmount === 500000) {
    // A later edit must still use the reloaded version and budget mode.
    await press(screen.getByRole('button', { name: i18n.t('groupSetup.increase') }))
  }
  await confirmEditor()
  expect(mockPatch).toHaveBeenCalledTimes(1)
  await confirmEditor()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2))
  expect(mockPatch.mock.calls[1][1]).toEqual({
    budgetMode: 'total', budgetAmount: 500000, expectedConstraintVersion: 12,
    ...(budgetAmount === 500000 ? { participantCount: 7 } : {}),
  })
  expect(mockRename).not.toHaveBeenCalled()
})

it('F-10 keeps the draft and saving blocked when reload fails, then permits a fresh retry', async () => {
  const { ApiError } = jest.requireActual('@/shared/api/errors') as typeof import('@/shared/api/errors')
  mockPatch.mockRejectedValueOnce(new ApiError(409, { code: 'CONSTRAINT_VERSION_CONFLICT', message: 'changed elsewhere' }))
  const fresh = roomFor('group-host', { constraintVersion: 10 })
  const refetch = jest.fn().mockResolvedValueOnce({ isError: true, error: new Error('offline'), data: fresh })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ isError: false, data: fresh })
  mockRoom.query.refetch = refetch
  await openArea()
  await typeField('Tên kèo', 'Tên mới')
  await chooseBudget()
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(screen.getByText(`Ngân sách: ${i18n.t('roomManage.conflict')}`)).toBeTruthy())
  for (let attempt = 0; attempt < 2; attempt++) {
    await press(screen.getByRole('button', { name: i18n.t('roomEdit.reload') }))
    await waitFor(() => expect(screen.getByText(i18n.t('roomEdit.reloadFailed'))).toBeTruthy())
    mockRoom.query.isError = true
    mockRoom.query.error = new Error('refetch failed')
    await screen.rerender(<RoomManageScreen />)
    expect(screen.getByTestId('room-edit-sheet')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
    expect(screen.getAllByRole('button').find(node => /500/.test(node.props.accessibilityLabel ?? ''))!.props.accessibilityState.selected).toBe(true)
    expect(mockPatch).toHaveBeenCalledTimes(1)
  }
  await press(screen.getByRole('button', { name: i18n.t('roomEdit.reload') }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeEnabled())
  // The successful title became clean before conflict; reload adopts its server value.
  expect(screen.getByLabelText('Tên kèo').props.value).toBe('')
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2))
  expect(mockPatch.mock.calls[1][1]).toEqual({ budgetMode: 'per_person', budgetAmount: 500000, expectedConstraintVersion: 10 })
  expect(mockRename).toHaveBeenCalledTimes(1)
})

it('F-11 treats the successfully reselected area as the committed baseline within the same sheet', async () => {
  mockRoom.query = mockLoaded(roomFor('group-host', { constraintVersion: 7, constraints: {
    budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND', administrativeArea: { ...mockArea, status: 'needs_reselection' },
  } }))
  await openArea()
  await chooseArea()
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled())
  await press(screen.getByRole('button', { name: 'Thành phố Hồ Chí Minh' }))
  await press(screen.getByRole('button', { name: 'Thành phố Hồ Chí Minh' }))
  expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
  await confirmEditor()
  expect(screen.queryByTestId('room-conditions-confirmation')).toBeNull()
  expect(mockPatch).toHaveBeenCalledTimes(1)
})

it('blocks an end before the start in the unified editor, including an unchanged stored start', async () => {
  mockRoom.query = mockLoaded(roomFor('group-host', { constraintVersion: 7, constraints: {
    budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND', administrativeArea: mockArea,
    startAt: new Date(2026, 10, 14, 19).toISOString(), endAt: new Date(2026, 10, 14, 22).toISOString(),
  } }))
  await openArea()
  await typeField('Kết thúc (không bắt buộc)', '14/11/2026 18:00')
  expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
  await confirmEditor()
  expect(screen.queryByTestId('room-conditions-confirmation')).toBeNull()
  expect(mockPatch).not.toHaveBeenCalled()
  await typeField('Bắt đầu', '14/11/2026 20:00')
  expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
  await confirmEditor()
  expect(mockPatch).not.toHaveBeenCalled()
  await typeField('Kết thúc (không bắt buộc)', '14/11/2026 21:00')
  expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeEnabled()
})

it('reports server ROOM_NOT_EDITABLE on rename without dropping the draft or sending constraints', async () => {
  const { ApiError } = jest.requireActual('@/shared/api/errors') as typeof import('@/shared/api/errors')
  mockRename.mockRejectedValueOnce(new ApiError(409, { code: 'ROOM_NOT_EDITABLE', message: 'locked elsewhere' }))
  await openArea()
  await typeField('Tên kèo', 'Tên chưa lưu')
  await chooseBudget()
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(screen.getByText(`Tên kèo: ${i18n.t('roomTitle.locked')}`)).toBeTruthy())
  expect(screen.getByLabelText('Tên kèo').props.value).toBe('Tên chưa lưu')
  expect(screen.getByTestId('room-edit-sheet')).toBeTruthy()
  expect(mockRename).toHaveBeenCalledWith('room-1', { title: 'Tên chưa lưu' })
  expect(mockPatch).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: i18n.t('roomEdit.reload') })).toBeNull()
})


it('F-10 preserves still-different title and schedule edits while cleaning an area now equal to the server', async () => {
  const { ApiError } = jest.requireActual('@/shared/api/errors') as typeof import('@/shared/api/errors')
  mockPatch.mockRejectedValueOnce(new ApiError(409, { code: 'CONSTRAINT_VERSION_CONFLICT', message: 'changed elsewhere' }))
  const fresh = roomFor('group-host', { title: 'Tên từ máy khác', constraintVersion: 15, constraints: {
    budgetMode: 'total', budgetAmount: 100000, currency: 'VND',
    administrativeArea: { ...mockArea, provinceCode: '79', provinceName: 'Thành phố Hồ Chí Minh', communeCode: null, communeName: null },
    startAt: new Date(2026, 10, 14, 18).toISOString(), endAt: new Date(2026, 10, 14, 22).toISOString(),
  } })
  const refetch = jest.fn().mockResolvedValue({ data: fresh, isError: false })
  mockRoom.query.refetch = refetch
  await openArea()
  await chooseArea()
  await typeField('Bắt đầu', '14/11/2026 19:00')
  await typeField('Kết thúc (không bắt buộc)', '14/11/2026 22:00')
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(screen.getByText(new RegExp(i18n.t('roomManage.conflict')))).toBeTruthy())
  await typeField('Tên kèo', 'Tên nháp')
  await press(screen.getByRole('button', { name: i18n.t('roomEdit.reload') }))
  await waitFor(() => expect(screen.getByText(i18n.t('roomEdit.reloaded'))).toBeTruthy())
  expect(screen.getByLabelText('Tên kèo').props.value).toBe('Tên nháp')
  expect(screen.getByLabelText('Bắt đầu').props.value).toBe('14/11/2026 19:00')
  expect(screen.getByLabelText('Kết thúc (không bắt buộc)').props.value).toBe('14/11/2026 22:00')
  await confirmEditor()
  expect(mockPatch).toHaveBeenCalledTimes(1)
  await confirmEditor()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2))
  expect(mockRename).toHaveBeenCalledWith('room-1', { title: 'Tên nháp' })
  expect(mockPatch.mock.calls[1][1]).toEqual({
    budgetMode: 'total', budgetAmount: 100000, expectedConstraintVersion: 15,
    startAt: new Date(2026, 10, 14, 19).toISOString(),
  })
})
