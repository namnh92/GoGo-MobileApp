import * as DialogModule from '@/shared/ui/dialog.view'
const mockDialog = jest.spyOn(DialogModule, 'Dialog')
import i18n from '@/shared/i18n'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { QueryClient } from '@tanstack/react-query'
import { AccessibilityInfo, Keyboard, ScrollView, TextInput, View, type KeyboardEvent, type KeyboardEventName } from 'react-native'
import { loaded as mockLoaded, roomFor, type QueryLike } from './harness'
import { render } from '@/shared/ui/__tests__/query-render'
import { queryKeys } from '@/shared/api/query-keys'

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
let mockDatasetVersion = 'ds-2026'
jest.mock('@/shared/location/use-current-location', () => ({
  useCurrentLocation: () => ({ request: mockLocationRequest, state: { status: 'unavailable' } }),
}))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, canGoBack: () => true, replace: jest.fn() }),
  useLocalSearchParams: () => ({ roomId: 'room-1' }),
  useFocusEffect: () => undefined,
}))
jest.mock('@/shared/api/endpoints/rooms', () => ({
  ...jest.requireActual('@/shared/api/endpoints/rooms'),
  updateRoomConstraints: (...args: unknown[]) => mockPatch(...args),
  renameRoom: (...args: unknown[]) => mockRename(...args),
}))
jest.mock('@/shared/api', () => ({
  ...jest.requireActual('@/shared/api'),
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
import RoomEditScreen from '@/features/gogo-room/room-edit.view'
let mockTimeProps: Parameters<typeof import('@/features/gogo-room/room-edit-time.view').RoomEditTime>[0]
jest.mock('@/features/gogo-room/room-edit-time.view', () => {
  const { RoomEditTime: Actual } = jest.requireActual('@/features/gogo-room/room-edit-time.view')
  return { RoomEditTime: (props: typeof mockTimeProps) => { mockTimeProps = props; return <Actual {...props} /> } }
})

let client: QueryClient
beforeEach(() => {
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
    // Sheet exit animations and keyboard visibility frames must finish in act.
    await act(async () => { jest.runOnlyPendingTimers() })
    client.clear()
  } finally { jest.useRealTimers() }
})
async function press(node: Parameters<typeof fireEvent.press>[0]) { await act(async () => { await fireEvent.press(node) }) }

const saveButton = () => screen.queryByTestId('room-conditions-confirmation')
  ? within(screen.getByTestId('room-conditions-confirmation')).getByRole('button', { name: i18n.t('roomEdit.saveSchedule') })
  : screen.getByRole('button', { name: i18n.t('roomEdit.save') })
async function openArea() { await render(<RoomEditScreen />, client) }
async function chooseArea() {
  await press(screen.getByTestId('create-location-field'))
  await press(screen.getByRole('button', { name: 'Thành phố Hà Nội' }))
  expect(screen.getByTestId('discovery-location-sheet')).toBeTruthy()
  await press(screen.getByRole('button', { name: 'Thành phố Hồ Chí Minh' }))
  await press(within(screen.getByTestId('discovery-location-sheet')).getByRole('button', { name: 'Xác nhận' }))
}
function scheduleValue(name: 'start' | 'end') { return mockTimeProps.values[name] }
async function typeField(label: string, value: string) {
  if (label === 'Bắt đầu' || label === 'Kết thúc (không bắt buộc)') {
    await act(async () => mockTimeProps.form.setValue(label === 'Bắt đầu' ? 'start' : 'end', value, { shouldValidate: true }))
  } else await act(async () => { await fireEvent.changeText(screen.getByLabelText(label), value) })
}
async function confirmEditor() { await press(saveButton()) }
async function openBudget() { await press(screen.getByTestId('room-edit-budget-card')) }
const budgetConfirm = () => within(screen.getByTestId('room-budget-sheet-confirm')).getByRole('button')
async function confirmBudget() { await press(budgetConfirm()) }
async function chooseBudget() {
  await openBudget()
  await press(screen.getByTestId('budget-option-to500'))
  await confirmBudget()
}
it('saves area codes through the real mutation and marks suggestions/plan stale', async () => {
  client.setQueryData(queryKeys.roomSuggestions('room-1'), { run: 'old' })
  client.setQueryData(queryKeys.roomCurrentPlan('room-1'), { plan: 'old' })
  await openArea()
  expect(saveButton().props.accessibilityState.disabled).toBe(true)
  await chooseArea()
  await press(saveButton())
  await press(saveButton())
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
  await press(saveButton())
  await press(saveButton())
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', {
    administrativeArea: { datasetVersion: 'ds-2026', provinceCode: '79', communeCode: null },
    originLat: null, originLng: null, radiusM: null,
    budgetMode: 'per_person', budgetAmount: 300000, expectedConstraintVersion: 7,
  }))
  expect(mockPatch).toHaveBeenCalledTimes(1)
})

it('blocks saving a selection from a replaced administrative dataset', async () => {
  await openArea()
  await chooseArea()
  mockDatasetVersion = 'ds-next'
  await screen.rerender(<RoomEditScreen />)
  expect(saveButton().props.accessibilityState.disabled).toBe(true)
  await press(saveButton())
  expect(mockPatch).not.toHaveBeenCalled()
})

it.each([409, 400])('keeps the draft and reports API %s without claiming success', async status => {
  const { ApiError } = jest.requireActual('@/shared/api/errors') as typeof import('@/shared/api/errors')
  mockPatch.mockRejectedValue(new ApiError(status, { code: 'TEST', message: 'rejected' }))
  await openArea()
  await chooseArea()
  await press(saveButton())
  await press(saveButton())
  await waitFor(() => expect(mockPatch).toHaveBeenCalled())
  expect(screen.getByText('Thành phố Hồ Chí Minh')).toBeTruthy()
  await waitFor(() => expect(screen.getByText(status === 409 ? 'Khu vực: Người khác vừa sửa điều kiện. Tải lại rồi thử lại nhé.' : 'Khu vực: Chưa lưu được. Thử lại nhé.')).toBeTruthy())
})

it.each(['budget', 'area'])('confirms %s saves and preserves the sheet and draft on cancel', async editor => {
  if (editor === 'area') {
    await openArea()
    await chooseArea()
  } else {
    await render(<RoomEditScreen />, client)
    await chooseBudget()
  }
  expect(screen.queryByText(i18n.t('roomManage.staleWarning'))).toBeNull()
  await press(saveButton())
  expect(screen.getByText('Đổi điều kiện phòng?')).toBeTruthy()
  expect(screen.getByText(i18n.t('roomManage.staleWarning'))).toBeTruthy()
  expect(mockPatch).not.toHaveBeenCalled()
  await press(screen.getAllByRole('button', { name: 'Huỷ' }).at(-1)!)
  expect(mockPatch).not.toHaveBeenCalled()
  expect(screen.getByTestId('room-edit-screen')).toBeTruthy()
  expect(screen.queryByText(i18n.t('roomManage.staleWarning'))).toBeNull()
  expect(saveButton().props.accessibilityState.disabled).toBe(false)
  if (editor === 'area') expect(screen.getByText('Thành phố Hồ Chí Minh')).toBeTruthy()
  else expect(screen.getByTestId('room-edit-budget-card').props.accessibilityLabel).toContain(i18n.t('createBudget.range.to500'))
  await press(saveButton())
  await press(saveButton())
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
  expect(mockPatch.mock.calls[0][1]).toMatchObject(editor === 'area'
    ? { administrativeArea: { provinceCode: '79' }, expectedConstraintVersion: 7 }
    : { budgetAmount: 500000, expectedConstraintVersion: 7 })
})

it('uses a warning ResultSheet for area confirmation; cancel and dismiss keep the draft', async () => {
  await openArea()
  await chooseArea()
  await press(saveButton())
  expect(screen.getByTestId('room-conditions-confirmation')).toBeTruthy()
  expect(mockDialog).not.toHaveBeenCalled()
  // Embedded ResultSheet reuses the editor Modal; it creates no second Modal.
  expect(screen.getByTestId('room-conditions-confirmation-modal')).toBeTruthy()
  await press(screen.getByRole('button', { name: 'Huỷ' }))
  expect(mockPatch).not.toHaveBeenCalled()
  expect(saveButton().props.accessibilityState.disabled).toBe(false)
  await press(saveButton())
  await act(async () => { await fireEvent(screen.getByTestId('room-conditions-confirmation-modal'), 'requestClose') })
  expect(mockPatch).not.toHaveBeenCalled()
  expect(saveButton().props.accessibilityState.disabled).toBe(false)
  await press(saveButton())
  await press(saveButton())
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
})

it.each(['vi', 'en'])('uses the shared ResultSheet for budget changes in %s, saving only on confirm', async language => {
  await act(async () => { await i18n.changeLanguage(language) })
  try {
    await render(<RoomEditScreen />, client)
    await chooseBudget()
    await press(saveButton())
    const confirmation = screen.getByTestId('room-conditions-confirmation')
    expect(within(confirmation).getByText(i18n.t('roomManage.staleWarning'))).toBeTruthy()
    expect(mockDialog).not.toHaveBeenCalled()
    const cancel = within(confirmation).getByRole('button', { name: i18n.t('common.cancel') })
    const confirm = within(confirmation).getByRole('button', { name: i18n.t('roomEdit.saveSchedule') })
    expect(cancel.parent).toBe(confirm.parent)
    expect(cancel.parent!.children.indexOf(cancel)).toBeLessThan(cancel.parent!.children.indexOf(confirm))
    await press(cancel)
    expect(mockPatch).not.toHaveBeenCalled()
    await press(saveButton())
    await press(saveButton())
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
    expect(mockPatch).toHaveBeenCalledWith('room-1', expect.objectContaining({ budgetAmount: 500000 }))
  } finally { await act(async () => { await i18n.changeLanguage('vi') }) }
})

it.each(['  Tên mới  ', '   '])('title-only saves trimmed/null title without a constraint request or stale confirmation (%s)', async title => {
  await openArea()
  await typeField('Tên kèo', title)
  // Empty is a change only when the original room had a title.
  if (!title.trim()) {
    await screen.unmount()
    mockRoom.query = mockLoaded(roomFor('group-host', { title: 'Tên cũ' }))
    await render(<RoomEditScreen />, client)
      await typeField('Tên kèo', title)
  }
  await confirmEditor()
  await waitFor(() => expect(mockRename).toHaveBeenCalledWith('room-1', { title: title.trim() || null }))
  expect(mockPatch).not.toHaveBeenCalled()
  expect(screen.queryByTestId('room-conditions-confirmation')).toBeNull()
  expect(saveButton().props.accessibilityState.disabled).toBe(true)
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
  expect(screen.getByTestId('room-edit-screen')).toBeTruthy()
  expect(mockRename).toHaveBeenCalledTimes(1)
  expect(mockPatch).toHaveBeenCalledTimes(1)
  expect(mockRename.mock.invocationCallOrder[0]).toBeLessThan(mockPatch.mock.invocationCallOrder[0])
  expect(screen.getByLabelText('Tên kèo').props.value).toBe('Tên mới')
  expect(screen.getByTestId('room-edit-budget-card').props.accessibilityLabel).toContain(i18n.t('createBudget.range.to500'))
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2))
  expect(mockRename).toHaveBeenCalledTimes(1)
  expect(saveButton().props.accessibilityState.disabled).toBe(true)
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
  expect(saveButton().props.accessibilityState.disabled).toBe(true)
  await typeField('Tên kèo', '')
  await typeField('Bắt đầu', '31/02/2026 19:00')
  expect(saveButton().props.accessibilityState.disabled).toBe(true)
  await typeField('Bắt đầu', '')
  await chooseBudget()
  await openBudget()
  await press(screen.getByTestId('budget-option-under300'))
  await confirmBudget()
  expect(saveButton().props.accessibilityState.disabled).toBe(true)
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
  expect(scheduleValue('start')).toBe('14/11/2026 19:00')
  expect(screen.getByTestId('room-edit-budget-card').props.accessibilityLabel).toContain(i18n.t('createBudget.range.to500'))
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
  await openBudget()
  await press(screen.getByRole('button', { name: i18n.t('groupSetup.groupTotal') }))
  await confirmBudget()
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
  await press(screen.getByTestId('create-location-field'))
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
  await press(screen.getByTestId('create-location-field'))
  await press(screen.getByRole('button', { name: i18n.t('home.useLocation') }))
  await fireEvent(screen.getByTestId('discovery-location-sheet-modal'), 'dismiss')
  expect(screen.getByTestId('create-location-recovery')).toBeTruthy()
  const errorDismiss = screen.getByTestId('create-location-recovery-modal').props.onDismiss
  await press(screen.getByRole('button', { name: i18n.t('common.cancel') }))
  await act(async () => errorDismiss?.())
  const infoDismiss = screen.getByTestId('create-location-recovery-modal').props.onDismiss
  await press(screen.getByRole('button', { name: i18n.t('createLocation.confirm') }))
  // Native dismissal may already have unmounted this sheet: notify its captured presenter.
  await act(async () => infoDismiss?.())
  await fireEvent(screen.getByTestId('discovery-location-sheet-modal'), 'requestClose')
  expect(screen.getByText('Phường Ba Đình, Thành phố Hà Nội')).toBeTruthy()
  expect(saveButton().props.accessibilityState.disabled).toBe(true)
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
  await waitFor(() => expect(saveButton().props.accessibilityState.disabled).toBe(true))
  await openBudget()
  await press(screen.getByTestId('budget-option-under300'))
  await confirmBudget()
  await confirmEditor()
  await confirmEditor()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2))
  expect(mockPatch.mock.calls[1][1]).toEqual({ budgetMode: 'per_person', budgetAmount: 300000, expectedConstraintVersion: 8 })
})

it.each(['active', 'completed', 'cancelled'] as const)('keeps the unified editor locked in %s', async status => {
  mockRoom.query = mockLoaded(roomFor('group-host', { status }))
  await openArea()
  expect(screen.getByLabelText('Tên kèo').props.editable).toBe(false)
  expect(screen.getByTestId('create-time-start-row')).toBeDisabled()
  expect(saveButton().props.accessibilityState.disabled).toBe(true)
  expect(screen.getByText(i18n.t('roomTitle.locked'))).toBeTruthy()
  expect(mockRename).not.toHaveBeenCalled()
  expect(mockPatch).not.toHaveBeenCalled()
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
  expect(saveButton()).toBeDisabled()
  // Background query updates alone must never advance the editor's version.
  mockRoom.query.data = fresh
  await screen.rerender(<RoomEditScreen />)
  expect(screen.getByLabelText('Tên kèo').props.value).toBe('')
  expect(saveButton()).toBeDisabled()
  expect(mockPatch).toHaveBeenCalledTimes(1)
  await press(screen.getByRole('button', { name: i18n.t('roomEdit.reload') }))
  expect(refetch).toHaveBeenCalledWith({ cancelRefetch: false })
  const modal = screen.getByTestId('room-edit-screen')
  expect(within(modal).getByTestId('blocking-loading-overlay')).toBeTruthy()
  await act(async () => { await fireEvent(modal, 'requestClose') })
  expect(screen.getByTestId('room-edit-screen')).toBeTruthy()
  await act(async () => finish({ data: fresh, isError: false }))
  await waitFor(() => expect(screen.queryByRole('button', { name: i18n.t('roomEdit.reload') })).toBeNull())
  expect(screen.getByLabelText('Tên kèo').props.value).toBe('Tên từ thiết bị khác')
  expect(scheduleValue('start')).toBe('15/11/2026 20:00')
  expect(screen.getByText(i18n.t('groupSetup.people', { n: 6 }))).toBeTruthy()
  expect(screen.getByTestId('room-edit-budget-card').props.accessibilityLabel).toContain(i18n.t('createBudget.range.to500'))
  expect(saveButton().props.accessibilityState.disabled).toBe(budgetAmount === 500000)
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
    await screen.rerender(<RoomEditScreen />)
    expect(screen.getByTestId('room-edit-screen')).toBeTruthy()
    expect(saveButton()).toBeDisabled()
    expect(screen.getByTestId('room-edit-budget-card').props.accessibilityLabel).toContain(i18n.t('createBudget.range.to500'))
    expect(mockPatch).toHaveBeenCalledTimes(1)
  }
  await press(screen.getByRole('button', { name: i18n.t('roomEdit.reload') }))
  await waitFor(() => expect(saveButton()).toBeEnabled())
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
  await waitFor(() => expect(saveButton()).toBeDisabled())
  await press(screen.getByTestId('create-location-field'))
  await press(screen.getByRole('button', { name: 'Thành phố Hồ Chí Minh' }))
  await press(screen.getByRole('button', { name: 'Thành phố Hồ Chí Minh' }))
  await press(within(screen.getByTestId('discovery-location-sheet')).getByRole('button', { name: 'Xác nhận' }))
  expect(saveButton()).toBeDisabled()
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
  expect(saveButton()).toBeDisabled()
  await confirmEditor()
  expect(screen.queryByTestId('room-conditions-confirmation')).toBeNull()
  expect(mockPatch).not.toHaveBeenCalled()
  await typeField('Bắt đầu', '14/11/2026 20:00')
  expect(saveButton()).toBeDisabled()
  await confirmEditor()
  expect(mockPatch).not.toHaveBeenCalled()
  await typeField('Kết thúc (không bắt buộc)', '14/11/2026 21:00')
  expect(saveButton()).toBeEnabled()
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
  expect(screen.getByTestId('room-edit-screen')).toBeTruthy()
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
  expect(scheduleValue('start')).toBe('14/11/2026 19:00')
  expect(scheduleValue('end')).toBe('14/11/2026 22:00')
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

it.each(['couple', 'group-host'] as const)('prefills custom budget, compares numeric dirty state, and saves its ceiling (%s)', async audience => {
  const mode = audience === 'couple' ? 'total' : 'per_person'
  mockRoom.query = mockLoaded(roomFor(audience, { constraintVersion: 7, constraints: {
    budgetMode: mode, budgetAmount: 650000, currency: 'VND', administrativeArea: mockArea,
  } }))
  await render(<RoomEditScreen />, client)
  await openBudget()
  expect(screen.getByRole('radio', { name: i18n.t('budgetPicker.custom') }).props.accessibilityState.selected).toBe(true)
  const unit = audience === 'couple' ? i18n.t('createBudget.unit.couple') : i18n.t('datePlan.perPerson')
  const label = `${i18n.t('budgetPicker.amount')} ${unit}`
  expect(screen.getByLabelText(label).props.value).toBe('650.000')
  const save = () => budgetConfirm()
  expect(saveButton().props.accessibilityState.disabled).toBe(true)
  await typeField(label, '650000')
  expect(save().props.accessibilityState.disabled).toBe(false)
  await confirmBudget()
  expect(saveButton().props.accessibilityState.disabled).toBe(true)
  await openBudget()
  await typeField(label, '')
  expect(save().props.accessibilityState.disabled).toBe(true)
  expect(screen.getByText(i18n.t('budgetPicker.required'))).toBeTruthy()
  await typeField(label, '9999')
  expect(save().props.accessibilityState.disabled).toBe(true)
  expect(screen.getByText(i18n.t('budgetPicker.bounds'))).toBeTruthy()
  await typeField(label, '675000')
  expect(save().props.accessibilityState.disabled).toBe(false)
  await confirmBudget()
  await press(saveButton())
  await press(saveButton())
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', expect.objectContaining({
    budgetAmount: 675000, budgetMode: mode, expectedConstraintVersion: 7,
  })))
})

it.each([0, 5000, 150000000, null])('F-13 saves a title with unchanged server budget %s', async amount => {
  mockRoom.query = mockLoaded(roomFor('group-host', { constraints: amount === null ? undefined : {
    budgetMode: 'per_person', budgetAmount: amount, currency: 'VND', administrativeArea: mockArea,
  } }))
  await openArea()
  await typeField('Tên kèo', 'Tên mới')
  const save = saveButton()
  expect(save.props.accessibilityState.disabled).toBe(false)
  expect(screen.queryByText(i18n.t('budgetPicker.bounds'))).toBeNull()
  await press(save)
  await waitFor(() => expect(mockRename).toHaveBeenCalledWith('room-1', { title: 'Tên mới' }))
  expect(mockPatch).not.toHaveBeenCalled()
})

it.each([0, 5000, 150000000])('F-13 preserves budget %s in unrelated constraint edits but bounds new amounts', async amount => {
  mockRoom.query = mockLoaded(roomFor('group-host', { constraintVersion: 7, constraints: {
    budgetMode: 'per_person', budgetAmount: amount, currency: 'VND', administrativeArea: mockArea,
  } }))
  await openArea()
  await chooseArea()
  const save = () => saveButton()
  const label = `${i18n.t('budgetPicker.amount')} ${i18n.t('datePlan.perPerson')}`
  await openBudget()
  await typeField(label, '9999')
  expect(budgetConfirm().props.accessibilityState.disabled).toBe(true)
  expect(screen.getByText(i18n.t('budgetPicker.bounds'))).toBeTruthy()
  await typeField(label, String(amount))
  expect(budgetConfirm().props.accessibilityState.disabled).toBe(false)
  await confirmBudget()
  expect(save().props.accessibilityState.disabled).toBe(false)
  await press(save())
  await press(save())
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', expect.objectContaining({ budgetAmount: amount })))
})

it('F-14 retains invalid budget paste and disables room Confirm until corrected', async () => {
  await openArea()
  await typeField('Tên kèo', 'Tên mới')
  await openBudget()
  await press(screen.getByRole('radio', { name: i18n.t('budgetPicker.custom') }))
  const label = `${i18n.t('budgetPicker.amount')} ${i18n.t('datePlan.perPerson')}`
  const save = () => budgetConfirm()
  for (const text of ['650000.50', '650.000,50', 'invalid']) {
    await typeField(label, text)
    expect(screen.getByLabelText(label).props.value).toBe(text)
    expect(screen.getByText(i18n.t('budgetPicker.format'))).toBeTruthy()
    expect(save().props.accessibilityState.disabled).toBe(true)
    await press(save())
    expect(mockRename).not.toHaveBeenCalled()
    expect(mockPatch).not.toHaveBeenCalled()
  }
  await typeField(label, '650,000')
  expect(screen.getByLabelText(label).props.value).toBe('650.000')
  expect(save().props.accessibilityState.disabled).toBe(false)
  await confirmBudget()
  await press(saveButton())
  await press(saveButton())
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', expect.objectContaining({ budgetAmount: 650000 })))
})

it('reveals custom budget and preview above the sheet keyboard with fixed row actions', async () => {
  jest.useFakeTimers()
  const listeners: Partial<Record<KeyboardEventName, (event: KeyboardEvent) => void>> = {}
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: KeyboardEventName, callback: (event: KeyboardEvent) => void) => {
    listeners[name] = callback
    return { remove: jest.fn() }
  }) as unknown as typeof Keyboard.addListener)
  const focus = jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {})
  const move = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {})
  jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(function (this: { props: { testID?: string } }, callback) {
    if (this.props.testID === 'room-budget-sheet-viewport') callback(0, 150, 390, 600)
    else if (this.props.testID === 'budget-custom-field') callback(16, 460, 358, 150)
    else callback(16, 460, 358, 80)
  })
  try {
    await openArea()
    await openBudget()
    await press(screen.getByRole('radio', { name: i18n.t('budgetPicker.custom') }))
    expect(focus).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(i18n.t('budgetPicker.required'))).toBeNull()
    const input = () => screen.getByLabelText(`${i18n.t('budgetPicker.amount')} ${i18n.t('datePlan.perPerson')}`)
    expect(input().props['aria-invalid']).not.toBe(true)
    expect(saveButton().props.accessibilityState.disabled).toBe(true)
    await act(async () => { listeners.keyboardDidShow?.({ endCoordinates: { screenY: 550 } } as KeyboardEvent); jest.runOnlyPendingTimers() })
    expect(move).toHaveBeenLastCalledWith(expect.objectContaining({ y: 68 }))
    await fireEvent.changeText(input(), '650000')
    expect(within(screen.getByTestId('budget-custom-field')).getByText(`650.000đ ${i18n.t('datePlan.perPerson')}`)).toBeTruthy()
    await fireEvent(input(), 'blur', {})
    move.mockClear()
    await fireEvent(input(), 'focus', {})
    await act(async () => { jest.runOnlyPendingTimers() })
    expect(move).toHaveBeenLastCalledWith(expect.objectContaining({ y: 68 }))
    const scroll = screen.getByTestId('room-budget-sheet-scroll')
    expect(scroll.props.scrollEnabled).not.toBe(false)
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled')
    expect(scroll.props.keyboardDismissMode).toBe('on-drag')
    expect(within(scroll).queryByRole('button', { name: i18n.t('roomEdit.save') })).toBeNull()
    expect(within(scroll).queryByTestId('room-budget-sheet-actions')).toBeNull()
    expect(within(screen.getByTestId('room-budget-sheet-actions')).getAllByRole('button').map(node => node.props.accessibilityLabel)).toEqual([i18n.t('common.cancel'), i18n.t('roomEdit.saveSchedule')])
    await screen.unmount()
  } finally {
    jest.restoreAllMocks()
  }
})

it('F-17 keeps custom budget pristine after saving a title in the open sheet', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined)
  try {
    await openArea()
    await typeField('Tên kèo', 'Tên mới')
    await confirmEditor()
    await waitFor(() => expect(mockRename).toHaveBeenCalledWith('room-1', { title: 'Tên mới' }))
    expect(screen.getByTestId('room-title-field')).toBeTruthy()
    for (let selection = 0; selection < 2; selection++) {
      await openBudget()
      await press(screen.getByTestId('budget-option-to500'))
      announce.mockClear()
      await press(screen.getByRole('radio', { name: i18n.t('budgetPicker.custom') }))
      const input = screen.getByLabelText(`${i18n.t('budgetPicker.amount')} ${i18n.t('datePlan.perPerson')}`)
      expect(input.props.value).toBe('')
      expect(screen.queryByText(i18n.t('budgetPicker.required'))).toBeNull()
      expect(input.props['aria-invalid']).not.toBe(true)
      expect(announce).not.toHaveBeenCalled()
      await fireEvent(input, 'blur', {})
      expect(screen.getByText(i18n.t('budgetPicker.required'))).toBeTruthy()
      expect(announce).toHaveBeenCalledWith(i18n.t('budgetPicker.required'))
      await press(within(screen.getByTestId('room-budget-sheet-cancel')).getByRole('button'))
    }
    expect(mockPatch).not.toHaveBeenCalled()
  } finally {
    announce.mockRestore()
  }
})
