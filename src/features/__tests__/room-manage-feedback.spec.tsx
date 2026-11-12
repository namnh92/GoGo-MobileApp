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
let mockFocus: (() => void) | undefined
let mockDatasetVersion = 'ds-2026'
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: 'room-1' }),
  useFocusEffect: (callback: () => void) => { mockFocus = callback },
}))
jest.mock('@/shared/api/endpoints/rooms', () => ({
  ...jest.requireActual('@/shared/api/endpoints/rooms'),
  updateRoomConstraints: (...args: unknown[]) => mockPatch(...args),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
  useRoom: () => mockRoom.query,
  usePlaceDetail: (placeId: string) => mockPlaceDetail(placeId),
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
})
afterEach(() => client.clear())
async function press(node: Parameters<typeof fireEvent.press>[0]) { await act(async () => { await fireEvent.press(node) }) }
async function openArea() {
  await render(<RoomManageScreen />, client)
  const edit = screen.getAllByRole('button', { name: 'Sửa' }).find(node => node.props.accessibilityHint === 'Khu vực')!
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
  expect(screen.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(true)
  await chooseArea()
  await press(screen.getByRole('button', { name: 'Lưu' }))
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', {
    administrativeArea: { datasetVersion: 'ds-2026', provinceCode: '79', communeCode: null },
    originLat: null, originLng: null, radiusM: null,
    budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND', expectedConstraintVersion: 7,
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
  await press(screen.getByRole('button', { name: 'Lưu' }))
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', {
    administrativeArea: { datasetVersion: 'ds-2026', provinceCode: '79', communeCode: null },
    originLat: null, originLng: null, radiusM: null,
    budgetMode: 'per_person', budgetAmount: 300000, currency: 'VND', expectedConstraintVersion: 7,
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
  expect(screen.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(true)
  await press(screen.getByRole('button', { name: 'Lưu' }))
  expect(mockPatch).not.toHaveBeenCalled()
})
it('blocks repeated submits and sheet dismissal until the area API resolves', async () => {
  let finish!: (value: ReturnType<typeof roomFor>) => void
  mockPatch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await openArea()
  await chooseArea()
  await press(screen.getByRole('button', { name: 'Lưu' }))
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
  await press(screen.getByRole('button', { name: 'Lưu' }))
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() => expect(mockPatch).toHaveBeenCalled())
  expect(screen.getByText('Thành phố Hồ Chí Minh')).toBeTruthy()
  expect(screen.getAllByText(status === 409 ? 'Người khác vừa sửa điều kiện. Tải lại rồi thử lại nhé.' : 'Chưa lưu được. Thử lại nhé.').length).toBeGreaterThan(0)
})

it('omits the danger heading, host permission card and inline warnings', async () => {
  await render(<RoomManageScreen />, client)
  for (const key of ['roomLobby.danger', 'roomManage.hostOnlyTitle', 'roomManage.hostOnlyBody', 'roomLobby.warning', 'roomManage.staleWarning']) {
    expect(screen.queryByText(i18n.t(key))).toBeNull()
  }
  expect(screen.getByRole('button', { name: 'Huỷ phòng' })).toBeTruthy()
  expect(screen.getByText(i18n.t('roomManage.cancelBody'))).toBeTruthy()
  await press(screen.getAllByRole('button', { name: 'Sửa' })[1])
  expect(screen.queryByText(i18n.t('roomManage.staleWarning'))).toBeNull()
})
it.each(['budget', 'area'])('confirms %s saves and preserves the sheet and draft on cancel', async editor => {
  if (editor === 'area') {
    await openArea()
    await chooseArea()
  } else {
    await render(<RoomManageScreen />, client)
    const edit = screen.getAllByRole('button', { name: 'Sửa' }).find(node => node.props.accessibilityHint === i18n.t('roomManage.budgetTitle'))!
    await press(edit)
    await press(screen.getAllByRole('button').find(node => String(node.props.accessibilityLabel).includes('500'))!)
  }
  expect(screen.queryByText(i18n.t('roomManage.staleWarning'))).toBeNull()
  await press(screen.getByRole('button', { name: 'Lưu' }))
  expect(within(screen.getByTestId('room-edit-sheet-modal')).getByText('Đổi điều kiện phòng?')).toBeTruthy()
  expect(screen.getByText(i18n.t('roomManage.staleWarning'))).toBeTruthy()
  expect(mockPatch).not.toHaveBeenCalled()
  await press(screen.getAllByRole('button', { name: 'Huỷ' }).at(-1)!)
  expect(mockPatch).not.toHaveBeenCalled()
  expect(screen.getByTestId('room-edit-sheet')).toBeTruthy()
  expect(screen.queryByText(i18n.t('roomManage.staleWarning'))).toBeNull()
  expect(screen.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(false)
  if (editor === 'area') expect(screen.getByText('Thành phố Hồ Chí Minh')).toBeTruthy()
  else expect(screen.getAllByRole('button').find(node => String(node.props.accessibilityLabel).includes('500'))!.props.accessibilityState.selected).toBe(true)
  await press(screen.getByRole('button', { name: 'Lưu' }))
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
    await press(within(screen.getByTestId('room-fact-schedule')).getByRole('button', { name: i18n.t('roomLobby.edit') }))
    expect(screen.getByLabelText(i18n.t('roomSchedule.start'))).toBeTruthy()
    expect(screen.getByTestId('room-title-field')).toBeTruthy()
    await press(screen.getByRole('button', { name: i18n.t('common.cancel') }))
    await press(within(screen.getByTestId('room-fact-name')).getByRole('button', { name: i18n.t('roomLobby.edit') }))
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
