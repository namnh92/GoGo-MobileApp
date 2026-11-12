import i18n from '@/shared/i18n'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { QueryClient } from '@tanstack/react-query'
import { render } from '@/shared/ui/__tests__/query-render'
import { loaded as mockLoaded, roomFor, type QueryLike } from './harness'

jest.spyOn(jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles'), 'ScopedTheme').mockImplementation(({ children }) => <>{children}</>)
const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockCanGoBack = jest.fn(() => true)
const mockDispatch = jest.fn()
let mockPrevent: { enabled: boolean; callback: (event: { data: { action: { type: string } } }) => void }
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ dispatch: mockDispatch }),
  usePreventRemove: (enabled: boolean, callback: typeof mockPrevent.callback) => { mockPrevent = { enabled, callback } },
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', session: { kind: 'user', userId: 'user-1' } }) }))
jest.mock('expo-router', () => ({ useFocusEffect: () => undefined, useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: mockCanGoBack }), useLocalSearchParams: () => ({ roomId: 'room-1' }) }))
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
import RoomEditScreen from '@/app/room/[roomId]/edit'
import CreateTimeScreen from '@/features/create-date/create-time.view'
import { useRoomStore } from '@/shared/store/roomStore'
import { pending as pendingQuery } from './harness'
import { dayTimeLabel } from '@/features/create-date/day-format'
import { localDayKey } from '@/features/create-date/schedule-day'

let client: QueryClient
const startAt = new Date(2026, 10, 14, 19, 17, 31, 123).toISOString()
const endAt = new Date(2026, 10, 16, 22, 43, 42, 456).toISOString()
const constraints = { budgetMode: 'per_person' as const, budgetAmount: 300000, currency: 'VND', administrativeArea: null, startAt, endAt }
beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers({ now: new Date(2026, 10, 12, 12), doNotFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'nextTick', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'hrtime'] })
  mockCanGoBack.mockReturnValue(true)
  useRoomStore.getState().resetDraft()
  useRoomStore.setState({ startTime: '03:00', endTime: '04:00', scheduleDay: '2027-01-01', durationPreset: 'upTo2h' })
  mockClosed = undefined
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })
  mockRoom.query = mockLoaded(roomFor('group-host', { constraints, constraintVersion: 7 }))
  mockSave.mockResolvedValue({ version: 5, isDraft: true })
  mockPatch.mockResolvedValue(roomFor('group-host', { constraintVersion: 8 }))
  mockRename.mockResolvedValue(roomFor('group-host', { title: 'Tên mới' }))
})
afterEach(() => { client.clear(); jest.useRealTimers() })
async function press(element: Parameters<typeof fireEvent.press>[0]) { await act(async () => { await fireEvent.press(element) }) }
const save = () => screen.getByRole('button', { name: i18n.t('roomEdit.save') })
const open = () => render(<RoomEditScreen />, client)
async function confirmAndClose() {
  await press(save())
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await act(async () => mockClosed?.())
}


const iso = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute, 31, 123).toISOString()
const cases = [
  ['future', iso(14, 19), iso(14, 22)],
  ['past earlier today', iso(12, 9, 17), iso(12, 10, 43)],
  ['past day', iso(10, 19, 17), iso(10, 22, 43)],
  ['past month', new Date(2026, 9, 10, 19, 17).toISOString(), new Date(2026, 9, 10, 22, 43).toISOString()],
  ['off-grid', iso(14, 19, 17), iso(14, 22, 43)],
  ['multi-day', iso(14, 19, 17), iso(17, 1, 43)],
  ['UTC crosses local day', '2026-11-12T17:17:31.123Z', '2026-11-13T18:43:42.456Z'],
  ['start only', iso(14, 19, 17), undefined],
  ['no schedule', undefined, undefined],
] as const

it.each(cases)('prefills %s in device time and stays pristine without an error or request', async (_name, start, end) => {
  mockRoom.query = mockLoaded(roomFor('couple', { constraints: { ...constraints, budgetMode: 'total', budgetAmount: 500000, startAt: start, endAt: end } }))
  await open()
  const row = (target: 'start' | 'end') => within(screen.getByTestId(`create-time-${target}-row`))
  const label = (value: string) => { const date = new Date(value); return dayTimeLabel(date, `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`, i18n.language) }
  expect(row('start').getByText(start ? label(start) : i18n.t('createTime.notSet'))).toBeTruthy()
  expect(row('end').getByText(end ? label(end) : i18n.t('createTime.notSet'))).toBeTruthy()
  if (start) expect(screen.getByTestId(`date-inline-day-${localDayKey(new Date(start))}`).props.accessibilityState.selected).toBe(true)
  else expect(screen.getAllByTestId(/^date-inline-day-/).every(node => !node.props.accessibilityState.selected)).toBe(true)
  expect(save()).toBeDisabled()
  expect(mockPrevent.enabled).toBe(false)
  for (const key of ['createTime.startPast', 'createTime.startRequired', 'roomSchedule.invalid']) expect(screen.queryByText(i18n.t(key))).toBeNull()
  await press(save())
  expect(mockPatch).not.toHaveBeenCalled()
  expect(mockRename).not.toHaveBeenCalled()
  expect(mockSave).not.toHaveBeenCalled()
})

it('initializes from a delayed room response and ignores the creation draft', async () => {
  const loaded = mockRoom.query
  mockRoom.query = pendingQuery()
  await open()
  expect(screen.getByTestId('room-edit-loading')).toBeTruthy()
  mockRoom.query = loaded
  await screen.rerender(<RoomEditScreen />)
  expect(within(screen.getByTestId('create-time-start-row')).getByText(/19:17/)).toBeTruthy()
  expect(within(screen.getByTestId('create-time-end-row')).getByText(/22:43/)).toBeTruthy()
  expect(save()).toBeDisabled()
  expect(mockPatch).not.toHaveBeenCalled()
})

it('hydrates a pristine cached room when its refreshed response supplies the stored schedule', async () => {
  const refreshed = mockRoom.query
  mockRoom.query = mockLoaded(roomFor('group-host', { constraints: { ...constraints, startAt: undefined, endAt: undefined } }))
  await open()
  expect(save()).toBeDisabled()
  mockRoom.query = refreshed
  await screen.rerender(<RoomEditScreen />)
  expect(within(screen.getByTestId('create-time-start-row')).getByText(/19:17/)).toBeTruthy()
  expect(within(screen.getByTestId('create-time-end-row')).getByText(/22:43/)).toBeTruthy()
  expect(save()).toBeDisabled()
  expect(mockPrevent.enabled).toBe(false)
  expect(mockPatch).not.toHaveBeenCalled()
  expect(mockRename).not.toHaveBeenCalled()
})

it('keeps a dirty draft unchanged when room data refreshes', async () => {
  await open()
  await fireEvent.changeText(screen.getByLabelText('Tên kèo'), 'Tên nháp')
  mockRoom.query = mockLoaded(roomFor('group-host', { title: 'Tên máy khác', constraints: { ...constraints, startAt: iso(18, 8) } }))
  await screen.rerender(<RoomEditScreen />)
  expect(screen.getByLabelText('Tên kèo').props.value).toBe('Tên nháp')
  expect(within(screen.getByTestId('create-time-start-row')).getByText(/19:17/)).toBeTruthy()
  expect(save()).not.toBeDisabled()
  expect(mockPatch).not.toHaveBeenCalled()
})

it('omits duration presets and estimates in edit', async () => {
  await open()
  expect(screen.queryByText(i18n.t('createTime.durationLabel'))).toBeNull()
  expect(screen.queryByText(/Dự kiến: ~/)).toBeNull()
  for (const key of ['upTo2h', 'upTo3h', 'upTo4h', 'evening']) expect(screen.queryByRole('button', { name: i18n.t(`createTime.preset.${key}`) })).toBeNull()
})

it('keeps duration presets and estimates in the creation wizard', async () => {
  useRoomStore.setState({ startTime: '19:00', endTime: '22:00', scheduleDay: '2026-11-14', durationPreset: 'upTo3h' })
  await render(<CreateTimeScreen />, client)
  expect(screen.getByText(i18n.t('createTime.durationLabel'))).toBeTruthy()
  expect(screen.getByText(i18n.t('createTime.estimated', { hours: 3 }))).toBeTruthy()
  expect(screen.getByRole('button', { name: '2–3 giờ' })).toBeTruthy()
})

function deferred() {
  let resolve!: (value: ReturnType<typeof roomFor>) => void
  let reject!: (error: Error) => void
  const promise = new Promise<ReturnType<typeof roomFor>>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
async function beginSave(path: 'title' | 'constraints' | 'both') {
  await open()
  if (path !== 'constraints') await fireEvent.changeText(screen.getByLabelText('Tên kèo'), 'Tên mới')
  if (path !== 'title') {
    await press(screen.getByRole('button', { name: i18n.t('groupSetup.increase') }))
    await confirmAndClose()
  } else await press(save())
}
async function closeOverlay() {
  expect(screen.queryByTestId('blocking-loading-overlay')).toBeNull()

}

it.each(['title', 'constraints', 'both'] as const)('blocks the entire %s save then returns once after the overlay closes without discard', async path => {
  const first = deferred(), last = deferred()
  const invalidated = jest.spyOn(client, 'invalidateQueries')
  if (path !== 'constraints') mockRename.mockReturnValueOnce(first.promise)
  if (path !== 'title') mockPatch.mockReturnValueOnce(path === 'both' ? last.promise : first.promise)
  await beginSave(path)
  await waitFor(() => expect(path === 'constraints' ? mockPatch : mockRename).toHaveBeenCalledTimes(1))
  expect(screen.getByTestId('blocking-loading-overlay')).toBeTruthy()
  expect(mockBack).not.toHaveBeenCalled()
  if (path === 'both') {
    expect(mockPatch).not.toHaveBeenCalled()
    await act(async () => first.resolve(roomFor('group-host', { title: 'Tên mới' })))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('blocking-loading-overlay')).toBeTruthy()
    expect(mockBack).not.toHaveBeenCalled()
  }
  const onDismiss = screen.getByTestId('blocking-loading-modal').props.onDismiss
  mockBack.mockImplementationOnce(() => {
    expect(mockPrevent.enabled).toBe(false)
    expect(screen.queryByTestId('blocking-loading-overlay')).toBeNull()
  })
  await act(async () => (path === 'both' ? last : first).resolve(roomFor('group-host', { constraintVersion: 8 })))
  await closeOverlay()
  await act(async () => { onDismiss?.(); onDismiss?.() })
  await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1))
  expect(invalidated).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['rooms', 'list'] }))
  expect(screen.queryByTestId('room-edit-discard')).toBeNull()
  expect(mockReplace).not.toHaveBeenCalled()
})

it.each(['title', 'constraints', 'both'] as const)('stays and hides the overlay on %s failure, then retries only the remaining parts', async path => {
  const failed = deferred()
  if (path === 'title') mockRename.mockReturnValueOnce(failed.promise)
  else mockPatch.mockReturnValueOnce(failed.promise)
  await beginSave(path)
  await waitFor(() => expect(path === 'title' ? mockRename : mockPatch).toHaveBeenCalledTimes(1))
  expect(screen.getByTestId('blocking-loading-overlay')).toBeTruthy()
  await act(async () => failed.reject(new Error('offline')))
  await closeOverlay()
  expect(screen.getByText(/Chưa lưu được. Thử lại nhé./)).toBeTruthy()
  expect(mockBack).not.toHaveBeenCalled()
  expect(mockReplace).not.toHaveBeenCalled()
  expect(save()).not.toBeDisabled()
  if (path === 'title') await press(save())
  else await confirmAndClose()
  await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1))
  expect(mockRename).toHaveBeenCalledTimes(path === 'title' ? 2 : path === 'both' ? 1 : 0)
  expect(mockPatch).toHaveBeenCalledTimes(path === 'title' ? 0 : 2)
})

it('replaces the lobby route on success when there is no back stack', async () => {
  mockCanGoBack.mockReturnValue(false)
  await beginSave('title')
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/room/room-1'))
  expect(mockBack).not.toHaveBeenCalled()
  expect(mockPrevent.enabled).toBe(false)
  expect(screen.queryByTestId('room-edit-discard')).toBeNull()
})

it('round 6h omits the leftover custom schedule caption for off-preset edit times', async () => {
  mockRoom.query = mockLoaded(roomFor('group-host', { constraints: { ...constraints,
    startAt: iso(14, 19, 17), endAt: iso(14, 22, 43),
  } }))
  await open()
  expect(screen.queryByTestId('create-time-custom')).toBeNull()
  expect(screen.queryByText('Lịch tùy chỉnh')).toBeNull()
})

it('round 6h omits custom schedule copy in the wizard with no duration selected', async () => {
  useRoomStore.setState({ startTime: '19:17', endTime: '22:43', scheduleDay: '2026-11-14', durationPreset: null })
  await render(<CreateTimeScreen />, client)
  expect(screen.getByText(i18n.t('createTime.durationLabel'))).toBeTruthy()
  expect(screen.queryByText('Lịch tùy chỉnh')).toBeNull()
  expect(screen.queryByTestId('create-time-custom')).toBeNull()
})
