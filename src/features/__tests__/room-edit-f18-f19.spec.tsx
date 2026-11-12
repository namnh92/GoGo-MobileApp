import i18n from '@/shared/i18n'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { QueryClient } from '@tanstack/react-query'
import { render } from '@/shared/ui/__tests__/query-render'
import { loaded as mockLoaded, roomFor, type QueryLike } from './harness'

jest.spyOn(jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles'), 'ScopedTheme').mockImplementation(({ children }) => <>{children}</>)
const mockBack = jest.fn()
const mockDispatch = jest.fn()
let mockPrevent: { enabled: boolean; callback: (event: { data: { action: { type: string } } }) => void }
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ dispatch: mockDispatch }),
  usePreventRemove: (enabled: boolean, callback: typeof mockPrevent.callback) => { mockPrevent = { enabled, callback } },
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }), useLocalSearchParams: () => ({ roomId: 'room-1' }) }))
const mockRoom: { query: QueryLike } = { query: mockLoaded(roomFor('group-host')) }
const mockPreferencesRead = jest.fn()
const mockTaxonomyRead = jest.fn()
const mockSave = jest.fn()
const mockPatch = jest.fn()
const mockRename = jest.fn()
jest.mock('@/shared/api/endpoints/preferences', () => ({ ...jest.requireActual('@/shared/api/endpoints/preferences'), saveMyPreferences: (...args: unknown[]) => mockSave(...args) }))
jest.mock('@/shared/api/endpoints/rooms', () => ({ ...jest.requireActual('@/shared/api/endpoints/rooms'), updateRoomConstraints: (...args: unknown[]) => mockPatch(...args), renameRoom: (...args: unknown[]) => mockRename(...args) }))
jest.mock('@/shared/api', () => ({ ...jest.requireActual('@/shared/api'),
  useRoom: () => mockRoom.query, useMyPreferences: mockPreferencesRead, useTaxonomies: mockTaxonomyRead,
}))
jest.mock('@/shared/administrative/queries', () => ({ useAdministrativeVersion: () => mockLoaded({ datasetVersion: 'ds-2026' }), useAdministrativeUnits: () => mockLoaded([]) }))
jest.mock('@/shared/location/use-current-location', () => ({ useCurrentLocation: () => ({ state: { status: 'unavailable' }, request: jest.fn() }) }))
// Keep the real ResultSheet/actions, but release native dismissal only when the test says so.
let mockClosed: (() => void) | undefined
jest.mock('@/shared/ui/sheet.view', () => {
  const actual = jest.requireActual<typeof import('@/shared/ui/sheet.view')>('@/shared/ui/sheet.view')
  const React = jest.requireActual<typeof import('react')>('react')
  const { View } = jest.requireActual<typeof import('react-native')>('react-native')
  return { ...actual, Sheet: (props: import('@/shared/ui/sheet.view').SheetProps) => {
    const wasVisible = React.useRef(false)
    React.useEffect(() => {
      if (props.testID === 'room-conditions-confirmation' && wasVisible.current && !props.visible) mockClosed = props.onClosed
      wasVisible.current = props.visible
    }, [props.visible, props.onClosed, props.testID])
    if (props.testID !== 'room-conditions-confirmation') return <actual.Sheet {...props} />
    return props.visible ? <View testID={props.testID}>{props.children}{props.footer}</View> : null
  } }
})
let mockTimeProps: Parameters<typeof import('@/features/gogo-room/room-edit-time.view').RoomEditTime>[0]
jest.mock('@/features/gogo-room/room-edit-time.view', () => {
  const { RoomEditTime: Actual } = jest.requireActual('@/features/gogo-room/room-edit-time.view')
  return { RoomEditTime: (props: typeof mockTimeProps) => { mockTimeProps = props; return <Actual {...props} /> } }
})
import RoomEditScreen from '@/app/room/[roomId]/edit'

let client: QueryClient
const startAt = new Date(2026, 10, 14, 19, 17, 31, 123).toISOString()
const endAt = new Date(2026, 10, 16, 22, 43, 42, 456).toISOString()
const constraints = { budgetMode: 'per_person' as const, budgetAmount: 300000, currency: 'VND', administrativeArea: null, startAt, endAt }
beforeEach(() => {
  jest.clearAllMocks()
  mockClosed = undefined
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })
  mockRoom.query = mockLoaded(roomFor('group-host', { constraints, constraintVersion: 7 }))
  mockSave.mockResolvedValue({ version: 5, isDraft: true })
  mockPatch.mockResolvedValue(roomFor('group-host', { constraintVersion: 8 }))
  mockRename.mockResolvedValue(roomFor('group-host', { title: 'Tên mới' }))
})
afterEach(() => client.clear())
async function press(element: Parameters<typeof fireEvent.press>[0]) { await act(async () => { await fireEvent.press(element) }) }
const save = () => screen.getByRole('button', { name: i18n.t('roomEdit.save') })
const open = () => render(<RoomEditScreen />, client)
async function chooseTime(target: 'start' | 'end', slot: string) {
  await press(screen.getByTestId(`create-time-${target}-row`))
  await press(screen.getByTestId(`${target}-time-sheet-wheel-hours-${slot.slice(0, 2)}`))
  await press(screen.getByTestId(`${target}-time-sheet-wheel-minutes-${slot.slice(3)}`))
  expect(screen.getByRole('button', { name: 'Xong' })).not.toBeDisabled()
  await press(screen.getByRole('button', { name: 'Xong' }))
}

async function confirmAndClose() {
  await press(save())
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await act(async () => mockClosed?.())
}

it('F-18 waits for Sheet.onClosed before starting PATCH or showing the overlay', async () => {
  let finish!: (room: ReturnType<typeof roomFor>) => void
  mockPatch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await open()
  await press(screen.getByRole('button', { name: i18n.t('groupSetup.increase') }))
  await press(save())
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  expect({ requests: mockPatch.mock.calls.length, overlay: screen.queryByTestId('blocking-loading-overlay') }).toEqual({ requests: 0, overlay: null })
  expect(mockClosed).toEqual(expect.any(Function))
  await act(async () => mockClosed?.())
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
  expect(screen.getByTestId('blocking-loading-overlay')).toBeTruthy()
  await act(async () => finish(roomFor('group-host', { constraintVersion: 8 })))
  // Duplicate dismissal notifications cannot submit twice.
  await act(async () => mockClosed?.())
  expect(mockPatch).toHaveBeenCalledTimes(1)
})

it.each(['cancel', 'dismiss'] as const)('F-18 %s never submits, including after onClosed', async action => {
  await open()
  await press(screen.getByRole('button', { name: i18n.t('groupSetup.increase') }))
  await press(save())
  if (action === 'cancel') await press(screen.getByRole('button', { name: 'Huỷ' }))
  else await press(screen.getByLabelText('Quay lại'))
  await act(async () => mockClosed?.())
  expect(mockPatch).not.toHaveBeenCalled()
  expect(screen.queryByTestId('blocking-loading-overlay')).toBeNull()
  expect(save()).not.toBeDisabled()
  await confirmAndClose()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
})

it.each([
  ['multi-day', 14, '19:17', 16, '22:43', '22:45'],
  ['overnight', 14, '23:17', 15, '01:43', '01:45'],
] as const)('F-19 preserves the stored end date on a %s time-only edit', async (_name, startDay, start, endDay, end, next) => {
  const iso = (day: number, time: string) => new Date(2026, 10, day, Number(time.slice(0, 2)), Number(time.slice(3))).toISOString()
  mockRoom.query = mockLoaded(roomFor('group-host', { constraints: { ...constraints,
    startAt: iso(startDay, start), endAt: iso(endDay, end) }, constraintVersion: 7 }))
  await open()
  await chooseTime('end', next)
  await confirmAndClose()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', {
    expectedConstraintVersion: 7, budgetMode: 'per_person', budgetAmount: 300000,
    endAt: iso(endDay, next),
  }))
})

it.each([
  ['multi-day', 16, '18:43', '20:15'],
  ['overnight', 15, '01:43', '23:30'],
] as const)('F-19 preserves both dates and the untouched end on a %s start-time edit', async (_name, endDay, end, next) => {
  const storedEnd = new Date(2026, 10, endDay, Number(end.slice(0, 2)), Number(end.slice(3)), 42, 456).toISOString()
  mockRoom.query = mockLoaded(roomFor('group-host', { constraints: { ...constraints, endAt: storedEnd }, constraintVersion: 7 }))
  await open()
  await chooseTime('start', next)
  await confirmAndClose()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', {
    expectedConstraintVersion: 7, budgetMode: 'per_person', budgetAmount: 300000,
    startAt: new Date(2026, 10, 14, Number(next.slice(0, 2)), Number(next.slice(3))).toISOString(),
  }))
})

it('F-19 uses an explicitly changed end date for the following time edit', async () => {
  await open()
  await act(async () => mockTimeProps.form.setValue('end', '17/11/2026 22:43', { shouldValidate: true }))
  await chooseTime('end', '22:45')
  await confirmAndClose()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', {
    expectedConstraintVersion: 7, budgetMode: 'per_person', budgetAmount: 300000,
    endAt: new Date(2026, 10, 17, 22, 45).toISOString(),
  }))
})

it('F-19 blocks a full timestamp before the start even when its clock time is later', async () => {
  await open()
  await act(async () => mockTimeProps.form.setValue('end', '13/11/2026 22:45', { shouldValidate: true }))
  expect(save()).toBeDisabled()
  await press(save())
  expect(mockPatch).not.toHaveBeenCalled()
})

it('F-19 keeps an explicitly changed start date on a time-only start edit', async () => {
  await open()
  await act(async () => mockTimeProps.form.setValue('start', '15/11/2026 19:17', { shouldValidate: true }))
  await chooseTime('start', '20:15')
  await confirmAndClose()
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', {
    expectedConstraintVersion: 7, budgetMode: 'per_person', budgetAmount: 300000,
    startAt: new Date(2026, 10, 15, 20, 15).toISOString(),
  }))
})

it('F-19 blocks a start edit beyond the stored end timestamp', async () => {
  await open()
  await act(async () => mockTimeProps.form.setValue('start', '17/11/2026 19:17', { shouldValidate: true }))
  expect(save()).toBeDisabled()
  await press(save())
  expect(mockPatch).not.toHaveBeenCalled()
})
