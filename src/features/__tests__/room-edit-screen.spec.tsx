import i18n from '@/shared/i18n'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { QueryClient } from '@tanstack/react-query'
import { StyleSheet } from 'react-native'
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils'
import { render } from '@/shared/ui/__tests__/query-render'
import { loaded as mockLoaded, roomFor, type QueryLike } from './harness'
import { spacing } from '@/shared/ui/tokens'
import { ThemeScopeProvider } from '@/shared/ui/scoped-theme'

jest.spyOn(jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles'), 'ScopedTheme').mockImplementation(({ children }) => <>{children}</>)
const mockBack = jest.fn()
const mockDispatch = jest.fn()
let mockPrevent: { enabled: boolean; callback: (event: { data: { action: { type: string } } }) => void }
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ dispatch: mockDispatch }),
  usePreventRemove: (enabled: boolean, callback: typeof mockPrevent.callback) => { mockPrevent = { enabled, callback } },
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, canGoBack: () => true }), useLocalSearchParams: () => ({ roomId: 'room-1' }) }))
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
import RoomEditScreen from '@/app/room/[roomId]/edit'

let client: QueryClient
const startAt = new Date(2026, 10, 14, 19, 17, 31, 123).toISOString()
const endAt = new Date(2026, 10, 16, 22, 43, 42, 456).toISOString()
const constraints = { budgetMode: 'per_person' as const, budgetAmount: 300000, currency: 'VND', administrativeArea: null, startAt, endAt }
beforeEach(() => {
  // Sheet dismissal schedules state updates; advance them only inside act.
  jest.useFakeTimers()
  jest.clearAllMocks()
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })
  mockRoom.query = mockLoaded(roomFor('group-host', { constraints, constraintVersion: 7 }))
  mockSave.mockResolvedValue({ version: 5, isDraft: true })
  mockPatch.mockResolvedValue(roomFor('group-host', { constraintVersion: 8 }))
  mockRename.mockResolvedValue(roomFor('group-host', { title: 'Tên mới' }))
})
afterEach(async () => {
  try {
    await act(async () => { jest.runOnlyPendingTimers() })
  } finally {
    client.clear()
    jest.useRealTimers()
  }
})
async function press(element: Parameters<typeof fireEvent.press>[0]) { await act(async () => { await fireEvent.press(element) }) }
const save = () => screen.getByRole('button', { name: i18n.t('roomEdit.save') })
const changeTitle = () => fireEvent.changeText(screen.getByLabelText('Tên kèo'), 'Tên mới')
const open = () => render(<RoomEditScreen />, client)
async function chooseTime(target: 'start' | 'end', slot: string) {
  await press(screen.getByTestId(`create-time-${target}-row`))
  await press(screen.getByTestId(`${target}-time-sheet-wheel-hours-${slot.slice(0, 2)}`))
  await press(screen.getByTestId(`${target}-time-sheet-wheel-minutes-${slot.slice(3)}`))
  await press(screen.getByRole('button', { name: 'Xong' }))
}

it.each(['orange', 'orangeDark'] as const)('renders host route with shared wizard sections, ordered fields and one fixed save bar in %s', async theme => {
  await render(<ThemeScopeProvider name={theme}><RoomEditScreen /></ThemeScopeProvider>, client)
  expect(screen.getByText('Chỉnh sửa kèo')).toBeTruthy()
  const scroll = screen.getByTestId('room-editor-scroll')
  const ids = ['room-title-field', 'create-location-section', 'create-budget-section', 'create-time-section']
  expect(within(scroll).getAllByTestId(/^(room-title-field|create-location-section|create-budget-section|create-time-section)$/).map(node => node.props.testID)).toEqual(ids)
  expect(mockPreferencesRead).not.toHaveBeenCalled(); expect(mockTaxonomyRead).not.toHaveBeenCalled()
  expect(screen.queryByTestId('room-edit-preferences')).toBeNull()
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(screen.queryByTestId('create-mood-seed-list')).toBeNull()
  expect(within(scroll).queryByRole('button', { name: 'Lưu thay đổi' })).toBeNull()
  expect(within(screen.getByTestId('room-edit-footer')).getAllByRole('button')).toHaveLength(1)
  expect(StyleSheet.flatten(screen.getByTestId('room-edit-footer').props.style).position).toBe('absolute')
  await fireEvent(screen.getByTestId('room-edit-footer'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 375, height: 100 } } })
  expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom).toBeGreaterThanOrEqual(100)
  expect(save()).toBeDisabled()
  await press(save())
  expect(mockRename).not.toHaveBeenCalled(); expect(mockPatch).not.toHaveBeenCalled(); expect(mockSave).not.toHaveBeenCalled()
})
it.each(['couple', 'group-host'] as const)('uses consistent fact headings and section spacing for %s', async audience => {
  mockRoom.query = mockLoaded(roomFor(audience, { constraints, constraintVersion: 7 }))
  await open()
  const scroll = screen.getByTestId('room-editor-scroll')
  const headings = audience === 'couple'
    ? ['Tên kèo', 'Khu vực', 'Ngân sách', 'Ngày giờ kèo']
    : ['Tên kèo', 'Khu vực', 'Số người', 'Ngân sách', 'Ngày giờ kèo']
  expect(within(scroll).getAllByText(/^(Tên kèo|Khu vực|Số người|Ngân sách|Ngày giờ kèo)$/).map(node => node.props.children)).toEqual(headings)
  const titleStyle = StyleSheet.flatten(within(scroll).getByText(headings[0]).props.style)
  for (const heading of headings) {
    const style = StyleSheet.flatten(within(scroll).getByText(heading).props.style)
    expect(style.fontSize).toBe(titleStyle.fontSize)
    expect(style.fontWeight).toBe(titleStyle.fontWeight)
  }
  const budget = within(screen.getByTestId('create-budget-section'))
  expect(budget.queryByText(i18n.t('createBudget.title'))).toBeNull()
  expect(budget.queryByText(i18n.t('groupSetup.budgetBy'))).toBeNull()
  expect(budget.queryByText(i18n.t('createBudget.body', { n: 2 }))).toBeNull()
  const time = within(screen.getByTestId('create-time-section'))
  expect(time.queryByText(i18n.t('createTime.title', { context: audience === 'couple' ? 'couple' : 'group' }))).toBeNull()
  expect(time.queryByText(i18n.t('createTime.body'))).toBeNull()
  expect(StyleSheet.flatten(scroll.props.contentContainerStyle).gap).toBe(spacing[6])
  expect(StyleSheet.flatten(screen.getByTestId('create-location-section').props.style)?.marginTop ?? 0).toBe(0)
})
it.each(['member', 'guest'] as const)('guards a direct edit link for %s', async role => {
  mockRoom.query = mockLoaded(roomFor('group-guest', { myRole: 'member' }))
  await open()
  expect(screen.getByText('Chỉ chủ phòng')).toBeTruthy()
  expect(screen.queryByTestId('room-editor-scroll')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).toBeNull()
})
it('uses the real shared wheel for a schedule-only sparse PATCH with required budget pair', async () => {
  mockRoom.query = mockLoaded(roomFor('group-host', { constraints: { ...constraints, startAt: new Date(2026, 10, 14, 19).toISOString(), endAt: new Date(2026, 10, 14, 22).toISOString() }, constraintVersion: 7 }))
  await open(); await chooseTime('start', '20:15')
  await press(save()); expect(mockPatch).not.toHaveBeenCalled()
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', { expectedConstraintVersion: 7, budgetMode: 'per_person', budgetAmount: 300000,
    startAt: new Date(2026, 10, 14, 20, 15).toISOString() }))
  expect(mockSave).not.toHaveBeenCalled(); expect(mockRename).not.toHaveBeenCalled()
})
it('shows a custom multi-day non-preset schedule unchanged and omits both timestamps on an unrelated edit', async () => {
  await open()
  expect(within(screen.getByTestId('create-time-start-row')).getByText(/19:17/)).toBeTruthy()
  expect(within(screen.getByTestId('create-time-end-row')).getByText(/22:43/)).toBeTruthy()
  for (const label of ['1–2 giờ', '2–3 giờ', '3–4 giờ', 'Cả tối']) expect(screen.queryByRole('button', { name: label })).toBeNull()
  expect(save()).toBeDisabled()
  await press(screen.getByRole('button', { name: i18n.t('groupSetup.increase') })); await press(save())
  await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', { expectedConstraintVersion: 7, budgetMode: 'per_person', budgetAmount: 300000, participantCount: 5 }))
})
it.each(['header', 'gesture', 'escape'] as const)('prompts for unsaved changes on %s back and only discards after confirmation', async path => {
  await open(); await changeTitle()
  expect(mockPrevent.enabled).toBe(true)
  if (path === 'header') await press(screen.getByLabelText('Quay lại'))
  if (path === 'gesture') await act(async () => mockPrevent.callback({ data: { action: { type: 'GO_BACK' } } }))
  if (path === 'escape') await act(async () => { await fireEvent(screen.getByTestId('room-edit-screen'), 'accessibilityEscape') })
  expect(screen.getByTestId('room-edit-discard')).toBeTruthy(); expect(mockBack).not.toHaveBeenCalled(); expect(mockDispatch).not.toHaveBeenCalled()
  await press(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }))
  expect(screen.getByLabelText('Tên kèo').props.value).toBe('Tên mới')
  await press(screen.getByLabelText('Quay lại'))
  const onDismiss = screen.getByTestId('room-edit-discard-modal').props.onDismiss
  await press(screen.getByRole('button', { name: 'Bỏ thay đổi' }))
  await act(async () => onDismiss?.())
  expect(mockBack).toHaveBeenCalledTimes(1); expect(mockSave).not.toHaveBeenCalled()
})
it('blocks back, submit and editable controls while the title is saving', async () => {
  let finish!: (value: ReturnType<typeof roomFor>) => void
  mockRename.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await open(); await changeTitle(); await press(save())
  await waitFor(() => expect(mockRename).toHaveBeenCalledTimes(1))
  expect(screen.getByTestId('blocking-loading-overlay')).toBeTruthy()
  await press(screen.getByLabelText('Quay lại', { includeHiddenElements: true }))
  await act(async () => mockPrevent.callback({ data: { action: { type: 'GO_BACK' } } }))
  expect(mockBack).not.toHaveBeenCalled(); expect(mockDispatch).not.toHaveBeenCalled()
  await act(async () => finish(roomFor('group-host', { title: 'Tên mới' })))
  expect(save()).toBeDisabled()
})
it('saves title before constraints, then retries a failed PATCH without renaming twice', async () => {
  mockPatch.mockRejectedValueOnce(new Error('offline'))
  await open(); await changeTitle()
  await press(screen.getByRole('button', { name: i18n.t('groupSetup.increase') }))
  await press(save()); await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1)); expect(mockSave).not.toHaveBeenCalled()
  await press(save()); await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2))
  expect(mockRename).toHaveBeenCalledTimes(1); expect(mockPatch).toHaveBeenCalledTimes(2)
  expect(mockRename.mock.invocationCallOrder[0]).toBeLessThan(mockPatch.mock.invocationCallOrder[0])
})
it('keeps a non-preset sub-minute duration custom instead of selecting a rounded preset', async () => {
  mockRoom.query = mockLoaded(roomFor('group-host', { constraints: { ...constraints,
    startAt: new Date(2026, 10, 14, 19, 0, 30).toISOString(), endAt: new Date(2026, 10, 14, 22, 0, 45).toISOString() } }))
  await open()
  expect(screen.queryByTestId('create-time-custom')).toBeNull()
  expect(screen.queryByText('Lịch tùy chỉnh')).toBeNull()
  expect(screen.queryByRole('button', { name: '2–3 giờ' })).toBeNull()
  expect(save()).toBeDisabled()
})
it('stages the chosen calendar day before an initially unset start without inventing a schedule', async () => {
  mockRoom.query = mockLoaded(roomFor('group-host', { constraints: { ...constraints, startAt: undefined, endAt: undefined }, constraintVersion: 7 }))
  await open()
  const target = new Date(); target.setDate(target.getDate() + 1)
  const key = [target.getFullYear(), String(target.getMonth() + 1).padStart(2, '0'), String(target.getDate()).padStart(2, '0')].join('-')
  await press(screen.getByTestId('date-inline-expand'))
  if (!screen.queryByTestId(`date-inline-day-${key}`)) await press(screen.getByTestId('date-sheet-next'))
  await press(screen.getByTestId(`date-inline-day-${key}`))
  expect(save()).toBeDisabled(); expect(mockPatch).not.toHaveBeenCalled()
  await chooseTime('start', '19:00')
  await press(save()); await press(screen.getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', { expectedConstraintVersion: 7, budgetMode: 'per_person', budgetAmount: 300000,
    startAt: new Date(target.getFullYear(), target.getMonth(), target.getDate(), 19).toISOString() }))
})

// Direct-route audience/state coverage from the former edit sheet.
describe.each(['orange', 'orangeDark'] as const)('full-screen editor matrix / %s', theme => {
  it.each((['couple', 'group-host', 'group-guest'] as const).flatMap(audience =>
    (['default', 'empty', 'pending-title', 'pending-schedule', 'error-title', 'error-schedule'] as const).map(state => [audience, state] as const),
  ))('%s × %s', async (audience, state) => {
    mockRoom.query = mockLoaded(roomFor(audience, { title: state === 'empty' ? undefined : 'Tên cũ', constraintVersion: 7,
      constraints: { ...constraints, startAt: new Date(2026, 10, 14, 19).toISOString(), endAt: new Date(2026, 10, 14, 22).toISOString() } }))
    await render(<ThemeScopeProvider name={theme}><RoomEditScreen /></ThemeScopeProvider>, client)
    if (audience === 'group-guest') {
      expect(screen.getByText('Chỉ chủ phòng')).toBeTruthy()
      expect(screen.queryByLabelText('Tên kèo')).toBeNull()
      expect(mockRename).not.toHaveBeenCalled(); expect(mockPatch).not.toHaveBeenCalled()
      return
    }
    expect(screen.getByLabelText('Tên kèo').props.value).toBe(state === 'empty' ? '' : 'Tên cũ')
    expect(screen.getByTestId('create-time-section')).toBeTruthy()
    if (state === 'default' || state === 'empty') { expect(save()).toBeDisabled(); return }
    let finish!: (value: ReturnType<typeof roomFor>) => void
    if (state.startsWith('pending')) (state === 'pending-title' ? mockRename : mockPatch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    else (state === 'error-title' ? mockRename : mockPatch).mockRejectedValueOnce(new Error('offline'))
    if (state.endsWith('title')) await fireEvent.changeText(screen.getByLabelText('Tên kèo'), 'Tên mới')
    else await chooseTime('start', '20:00')
    await press(save())
    if (state.endsWith('schedule')) await press(screen.getByRole('button', { name: 'Xác nhận' }))
    if (state.startsWith('pending')) {
      await waitFor(() => expect(state.endsWith('title') ? mockRename : mockPatch).toHaveBeenCalled())
      expect(screen.getByTestId('blocking-loading-overlay')).toBeTruthy()
      expect(screen.getByLabelText('Tên kèo', { includeHiddenElements: true }).props.editable).toBe(false)
      expect(screen.getByTestId('create-time-start-row', { includeHiddenElements: true })).toBeDisabled()
      await press(screen.getByLabelText('Quay lại', { includeHiddenElements: true }))
      await act(async () => mockPrevent.callback({ data: { action: { type: 'GO_BACK' } } }))
      expect(mockBack).not.toHaveBeenCalled(); expect(mockDispatch).not.toHaveBeenCalled()
      await act(async () => finish(roomFor(audience, { constraintVersion: 8 })))
    } else {
      expect(await screen.findByText(/Chưa lưu được. Thử lại nhé./)).toBeTruthy()
      if (state.endsWith('title')) expect(mockPatch).not.toHaveBeenCalled()
      else expect(mockRename).not.toHaveBeenCalled()
    }
    expect(screen.getByTestId('room-edit-screen')).toBeTruthy()
  })
})


const budgetCommit = () => within(screen.getByTestId('room-budget-sheet-confirm')).getByRole('button')
const budgetCancel = () => within(screen.getByTestId('room-budget-sheet-cancel')).getByRole('button')

it.each([
  [800000, '500.000đ – 800.000đ / cả phòng (2 người)', 'Bữa ăn thịnh soạn, không gian ấm cúng'],
  [5000000, 'Không quan trọng', 'Miễn là vui là được'],
  [650000, '650.000đ / cả phòng (2 người)', 'Tự đặt mức chi tối đa'],
  [0, 'Chưa đặt ngân sách', 'Tự đặt mức chi tối đa'],
] as const)('shows only the selected budget card for amount %s', async (amount, title, description) => {
  mockRoom.query = mockLoaded(roomFor('couple', { constraints: { ...constraints, budgetMode: 'total', budgetAmount: amount } }))
  await open()
  const section = within(screen.getByTestId('create-budget-section'))
  const card = section.getByRole('button', { name: title })
  expect(section.getAllByRole('button')).toHaveLength(1)
  expect(section.queryByRole('radio')).toBeNull()
  expect(within(card).getByText(description)).toBeTruthy()
  expect(card.props.accessibilityHint).toBe(i18n.t('budgetPicker.changeHint'))
  expect(StyleSheet.flatten(card.props.style).minHeight).toBeGreaterThanOrEqual(44)
  expect(screen.queryByTestId('budget-custom-field')).toBeNull()
  expect(save()).toBeDisabled()
})

it.each(['cancel', 'dismiss', 'swipe'] as const)('discards pending amount and mode on budget sheet %s', async close => {
  await open()
  await press(screen.getByTestId('room-edit-budget-card'))
  const sheet = within(screen.getByTestId('room-budget-sheet'))
  expect(sheet.getByText('Ngân sách')).toBeTruthy()
  expect(sheet.getAllByRole('radio')).toHaveLength(6)
  expect(sheet.getByTestId('budget-option-under300').props.accessibilityState.selected).toBe(true)
  await press(sheet.getByTestId('budget-option-to800'))
  await press(sheet.getByRole('button', { name: i18n.t('groupSetup.groupTotal') }))
  expect(save()).toBeDisabled()
  expect(mockPatch).not.toHaveBeenCalled()
  if (close === 'cancel') await press(budgetCancel())
  else if (close === 'dismiss') await fireEvent(screen.getByTestId('room-budget-sheet-modal'), 'requestClose')
  else await act(async () => { fireGestureHandler(getByGestureTestId('sheet-dismiss'), [{ translationY: 80, velocityY: 600 }]) })
  expect(screen.getByTestId('room-edit-budget-card').props.accessibilityLabel).toBe('Dưới 300.000đ /người')
  expect(save()).toBeDisabled()
  await press(screen.getByTestId('room-edit-budget-card'))
  expect(screen.getByTestId('budget-option-under300').props.accessibilityState.selected).toBe(true)
  expect(screen.getByRole('button', { name: i18n.t('groupSetup.perPerson') }).props.accessibilityState.selected).toBe(true)
})

it('confirms budget locally, marks changes, and clears changed state when restored', async () => {
  await open()
  await press(screen.getByTestId('room-edit-budget-card'))
  const actions = screen.getByTestId('sheet-actions')
  expect(StyleSheet.flatten(actions.props.style).flexDirection).toBe('row')
  for (const id of ['room-budget-sheet-cancel', 'room-budget-sheet-confirm']) {
    expect(StyleSheet.flatten(screen.getByTestId(id).props.style)).toMatchObject({ flex: 1, flexBasis: 0, minWidth: 0 })
  }
  expect(within(actions).getAllByRole('button').map(button => button.props.accessibilityLabel)).toEqual(['Huỷ', 'Xác nhận'])
  await press(budgetCommit())
  expect(save()).toBeDisabled()
  await press(screen.getByTestId('room-edit-budget-card'))
  await press(screen.getByTestId('budget-option-to800'))
  await press(budgetCommit())
  expect(screen.getByTestId('room-edit-budget-card').props.accessibilityLabel).toBe('500.000đ – 800.000đ /người')
  expect(save()).not.toBeDisabled()
  expect(mockPatch).not.toHaveBeenCalled()
  expect(mockRename).not.toHaveBeenCalled()
  await press(screen.getByTestId('room-edit-budget-card'))
  await press(screen.getByTestId('budget-option-under300'))
  await press(budgetCommit())
  expect(save()).toBeDisabled()
})

it('discards invalid custom text and validation on cancel, reopening the committed choice', async () => {
  await open()
  await press(screen.getByTestId('room-edit-budget-card'))
  await press(screen.getByTestId('budget-option-custom'))
  const label = `${i18n.t('budgetPicker.amount')} ${i18n.t('datePlan.perPerson')}`
  await fireEvent.changeText(screen.getByLabelText(label), '650000.50')
  expect(screen.getByText(i18n.t('budgetPicker.format'))).toBeTruthy()
  expect(budgetCommit()).toBeDisabled()
  await press(budgetCancel())
  expect(save()).toBeDisabled()
  await press(screen.getByTestId('room-edit-budget-card'))
  expect(screen.getByTestId('budget-option-under300').props.accessibilityState.selected).toBe(true)
  expect(screen.queryByTestId('budget-custom-field')).toBeNull()
  await press(screen.getByTestId('budget-option-custom'))
  expect(screen.getByLabelText(label).props.value).toBe('')
  expect(screen.queryByText(i18n.t('budgetPicker.format'))).toBeNull()
  expect(screen.queryByText(i18n.t('budgetPicker.required'))).toBeNull()
  expect(mockPatch).not.toHaveBeenCalled()
})

it('keeps invalid custom entry in the sheet and commits only valid whole amounts', async () => {
  await open()
  await press(screen.getByTestId('room-edit-budget-card'))
  await press(screen.getByTestId('budget-option-custom'))
  expect(budgetCommit()).toBeDisabled()
  expect(screen.queryByText(i18n.t('budgetPicker.required'))).toBeNull()
  const label = `${i18n.t('budgetPicker.amount')} ${i18n.t('datePlan.perPerson')}`
  for (const text of ['9999', '100000001', '650000.50']) {
    await fireEvent.changeText(screen.getByLabelText(label), text)
    expect(budgetCommit()).toBeDisabled()
    await press(budgetCommit())
    expect(mockPatch).not.toHaveBeenCalled()
    expect(screen.getByTestId('room-budget-sheet-scroll')).toBeTruthy()
  }
  await fireEvent.changeText(screen.getByLabelText(label), '650000')
  expect(budgetCommit()).not.toBeDisabled()
  await press(budgetCommit())
  expect(screen.getByTestId('room-edit-budget-card').props.accessibilityLabel).toBe('650.000đ /người')
  expect(save()).not.toBeDisabled()
  expect(mockPatch).not.toHaveBeenCalled()
  await press(save())
  await press(within(screen.getByTestId('room-conditions-confirmation')).getByRole('button', { name: 'Xác nhận' }))
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('room-1', {
    expectedConstraintVersion: 7, budgetAmount: 650000, budgetMode: 'per_person',
  }))
})


it('retains custom presentation when its amount equals a tier without marking an unchanged budget dirty', async () => {
  mockRoom.query = mockLoaded(roomFor('couple', { constraints: { ...constraints, budgetMode: 'total', budgetAmount: 800000 } }))
  await open()
  await press(screen.getByTestId('room-edit-budget-card'))
  await press(screen.getByTestId('budget-option-custom'))
  await fireEvent.changeText(screen.getByLabelText(`${i18n.t('budgetPicker.amount')} ${i18n.t('createBudget.unit.couple')}`), '800000')
  await press(budgetCommit())
  expect(screen.getByTestId('room-edit-budget-card').props.accessibilityLabel).toBe('800.000đ / cả phòng (2 người)')
  expect(save()).toBeDisabled()
  await press(screen.getByTestId('room-edit-budget-card'))
  expect(screen.getByTestId('budget-option-custom').props.accessibilityState.selected).toBe(true)
  expect(screen.getByTestId('budget-option-to800').props.accessibilityState.selected).toBe(false)
  expect(screen.getByTestId('budget-custom-field')).toBeTruthy()
  await press(screen.getByTestId('budget-option-to800'))
  await press(budgetCommit())
  expect(screen.getByTestId('room-edit-budget-card').props.accessibilityLabel).toBe('500.000đ – 800.000đ / cả phòng (2 người)')
  expect(save()).toBeDisabled()
})
