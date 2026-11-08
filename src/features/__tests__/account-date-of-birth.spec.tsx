import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, waitFor, within } from '@testing-library/react-native'
import { StyleSheet, processColor } from 'react-native'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import { themes } from '@/shared/ui/theme'
import { motion } from '@/shared/ui/tokens'
import i18n from '@/shared/i18n'
import { renderScreen } from './harness'
import { scriptedTime } from './scripted-time'

const mockUpdateProfile = jest.fn()
const mockGetMe = jest.fn()
const mockBack = jest.fn()
jest.mock('@/shared/api/endpoints/sessions', () => ({
  ...jest.requireActual('@/shared/api/endpoints/sessions'),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  getMe: (...args: unknown[]) => mockGetMe(...args),
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }) }))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ status: 'user', deleteAccount: jest.fn() }) }))
import AccountScreen from '@/features/account/account.view'
import { todayInVietnam } from '@/features/account/date-of-birth'
import { ApiError, queryKeys, type Me } from '@/shared/api'

const INPUT = 'Ngày sinh (ngày/tháng/năm)'
const NAME = 'Tên hiển thị'
const profile = (overrides: Partial<Me> = {}): Me => ({
  actorType: 'user', id: 'user-a', displayName: 'An', locale: 'vi', avatarUrl: null,
  homeArea: null, interests: { mood: [] }, usualBudget: null,
  capabilities: { avatarUpload: 'available' }, ...overrides,
} as Me)
let client: QueryClient
let server: Me
// Own wheel batches and Sheet exit frames, including under parallel-worker load.
scriptedTime()
beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } })
  mockBack.mockClear()
  mockUpdateProfile.mockReset().mockImplementation(async (body: Partial<Me>) => { server = { ...server, ...body }; return server })
  mockGetMe.mockReset().mockImplementation(async () => server)
})
afterEach(async () => { client.clear(); await act(async () => { await i18n.changeLanguage('vi') }); UnistylesSheet.configure({ themes }) })
async function mount(initial = profile()) {
  server = initial
  client.setQueryData(queryKeys.me(), initial)
  return renderScreen(<QueryClientProvider client={client}><AccountScreen /></QueryClientProvider>)
}
type View = Awaited<ReturnType<typeof mount>>
async function type(view: View, label: string, value: string) { await fireEvent.changeText(view.getByLabelText(label), value) }
async function refetch(overrides: Partial<Me>) {
  server = { ...server, ...overrides }
  await act(async () => { await client.refetchQueries({ queryKey: queryKeys.me() }) })
}

it('has one header save, disabled until a valid change, and no body save or change-photo button', async () => {
  const view = await mount()
  const header = within(view.getByTestId('app-header'))
  expect(view.getAllByText('Lưu')).toHaveLength(1)
  expect(header.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(true)
  expect(view.queryByText('Lưu ngày sinh')).toBeNull()
  expect(view.queryByText('Đổi ảnh')).toBeNull()
  await type(view, NAME, '  ')
  expect(view.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(true)
  expect(await view.findByText('Nhập tên hiển thị từ 1 đến 50 ký tự.')).toBeTruthy()
})
it('saves both fields in one patch and resets dirty state after success', async () => {
  const view = await mount()
  await type(view, NAME, '  Bình  ')
  await type(view, INPUT, '29/02/2024')
  await fireEvent.press(view.getByText('Lưu'))
  expect(mockUpdateProfile).toHaveBeenCalledTimes(1)
  expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: 'Bình', dateOfBirth: '2024-02-29' })
  expect(await view.findByText('✓ Đã lưu')).toBeTruthy()
  expect(view.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(true)
})
it('saves a name-only change while preserving the birthday', async () => {
  const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
  await type(view, NAME, 'Bình')
  await fireEvent.press(view.getByText('Lưu'))
  expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: 'Bình' })
})
it('saves only the birthday when the name is untouched', async () => {
  const view = await mount()
  await type(view, INPUT, '01/01/2000')
  await fireEvent.press(view.getByText('Lưu'))
  expect(mockUpdateProfile).toHaveBeenCalledWith({ dateOfBirth: '2000-01-01' })
})
it('resyncs both untouched fields on /me refetch without enabling save or prompting on back', async () => {
  const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
  await refetch({ displayName: 'Server name', dateOfBirth: '1985-11-03' })
  expect(view.getByLabelText(NAME).props.value).toBe('Server name')
  expect(view.getByLabelText(INPUT).props.value).toBe('03/11/1985')
  expect(view.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(view.getByRole('button', { name: 'Quay lại' }))
  expect(mockBack).toHaveBeenCalledTimes(1)
})
it.each([
  { label: NAME, draft: 'Bình', remote: { displayName: 'Server name', dateOfBirth: '1985-11-03' }, other: INPUT, shown: '03/11/1985', patch: { displayName: 'Bình' } },
  { label: INPUT, draft: '01/01/2000', remote: { displayName: 'Server name', dateOfBirth: '1985-11-03' }, other: NAME, shown: 'Server name', patch: { dateOfBirth: '2000-01-01' } },
])('preserves the $label draft and resyncs the other field before saving only the draft', async ({ label, draft, remote, other, shown, patch }) => {
  const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
  await type(view, label, draft)
  await refetch(remote)
  expect(view.getByLabelText(label).props.value).toBe(draft)
  expect(view.getByLabelText(other).props.value).toBe(shown)
  await fireEvent.press(view.getByText('Lưu'))
  expect(mockUpdateProfile).toHaveBeenCalledWith(patch)
  expect(await view.findByText('✓ Đã lưu')).toBeTruthy()
  expect(view.getByLabelText(other).props.value).toBe(shown)
  expect(view.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(true)
})
it('resyncs a reverted field while preserving another dirty field', async () => {
  const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
  await type(view, NAME, 'Draft')
  await type(view, NAME, 'An')
  await type(view, INPUT, '01/01/2000')
  await refetch({ displayName: 'Server name' })
  expect(view.getByLabelText(NAME).props.value).toBe('Server name')
  expect(view.getByLabelText(INPUT).props.value).toBe('01/01/2000')
  await fireEvent.press(view.getByText('Lưu'))
  expect(mockUpdateProfile).toHaveBeenCalledWith({ dateOfBirth: '2000-01-01' })
})
it.each([
  { label: NAME, draft: 'Bình', remote: { displayName: 'Bình' }, other: INPUT, otherDraft: '01/01/2000', patch: { dateOfBirth: '2000-01-01' } },
  { label: INPUT, draft: '01/01/2000', remote: { dateOfBirth: '2000-01-01' }, other: NAME, otherDraft: 'Bình', patch: { displayName: 'Bình' } },
])('omits a dirty $label that already matches the latest server value', async ({ label, draft, remote, other, otherDraft, patch }) => {
  const view = await mount()
  await type(view, label, draft)
  await refetch(remote)
  expect(view.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(view.getByText('Lưu'))
  expect(mockUpdateProfile).not.toHaveBeenCalled()
  await type(view, other, otherDraft)
  await fireEvent.press(view.getByText('Lưu'))
  expect(mockUpdateProfile).toHaveBeenCalledWith(patch)
})
it('follows later refetches after drafts converge with the server', async () => {
  const view = await mount()
  await type(view, NAME, 'Bình')
  await type(view, INPUT, '1/1/2000')
  await refetch({ displayName: 'Bình', dateOfBirth: '2000-01-01' })
  expect(view.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(true)
  await refetch({ displayName: 'Server name', dateOfBirth: '1985-11-03' })
  expect(view.getByLabelText(NAME).props.value).toBe('Server name')
  expect(view.getByLabelText(INPUT).props.value).toBe('03/11/1985')
  expect(view.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(true)
})
it('treats whitespace and alternate date formatting as unchanged values', async () => {
  const view = await mount(profile({ dateOfBirth: '2000-01-01' }))
  await type(view, NAME, '  An  ')
  await type(view, INPUT, '1/1/2000')
  expect(view.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(view.getByText('Lưu'))
  expect(mockUpdateProfile).not.toHaveBeenCalled()
  expect(view.getByLabelText(NAME).props.value).toBe('  An  ')
  expect(view.getByLabelText(INPUT).props.value).toBe('1/1/2000')
  await refetch({ displayName: 'Server name', dateOfBirth: '1985-11-03' })
  expect(view.getByLabelText(NAME).props.value).toBe('Server name')
  expect(view.getByLabelText(INPUT).props.value).toBe('03/11/1985')
})
it('keeps an explicit birthday clear across refetch and saves only null', async () => {
  const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
  await fireEvent.press(view.getByText('Xoá ngày sinh'))
  await refetch({ displayName: 'Server name', dateOfBirth: '1985-11-03' })
  expect(view.getByLabelText(INPUT).props.value).toBe('')
  expect(view.getByLabelText(NAME).props.value).toBe('Server name')
  await fireEvent.press(view.getByText('Lưu'))
  expect(mockUpdateProfile).toHaveBeenCalledWith({ dateOfBirth: null })
})
it('clears the birthday as a draft, then saves null with the header action', async () => {
  const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
  await fireEvent.press(view.getByText('Xoá ngày sinh'))
  expect(mockUpdateProfile).not.toHaveBeenCalled()
  await fireEvent.press(view.getByText('Lưu'))
  expect(mockUpdateProfile).toHaveBeenCalledWith({ dateOfBirth: null })
  expect(view.getByLabelText(INPUT).props.value).toBe('')
})
it('blocks impossible and future dates with inline validation', async () => {
  const view = await mount()
  await type(view, INPUT, '29/02/2027')
  expect(await view.findByText('Ngày không hợp lệ. Nhập một ngày có thật theo dạng ngày/tháng/năm.')).toBeTruthy()
  expect(view.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(true)
  const future = `${Number(todayInVietnam().slice(0, 4)) + 1}`
  await type(view, INPUT, `01/01/${future}`)
  expect(await view.findByText('Ngày sinh không thể sau hôm nay.')).toBeTruthy()
  await fireEvent.press(view.getByText('Lưu'))
  expect(mockUpdateProfile).not.toHaveBeenCalled()
})
it('renders field-specific server errors, preserves typing and allows retry', async () => {
  mockUpdateProfile.mockRejectedValueOnce(new ApiError(400, { code: 'VALIDATION_FAILED', message: 'invalid', field_errors: [
    { field: 'displayName', code: 'invalid', message: 'invalid' }, { field: 'dateOfBirth', code: 'too_big', message: 'invalid' },
  ] }))
  const view = await mount()
  await type(view, NAME, 'Bình')
  await type(view, INPUT, '01/01/2000')
  await fireEvent.press(view.getByText('Lưu'))
  expect(await view.findByText('Ngày sinh không thể sau hôm nay.')).toBeTruthy()
  expect(view.getByText('Nhập tên hiển thị từ 1 đến 50 ký tự.')).toBeTruthy()
  expect(view.getByLabelText(INPUT).props.value).toBe('01/01/2000')
  expect(view.queryByText('✓ Đã lưu')).toBeNull()
  await fireEvent.press(view.getByText('Lưu'))
  expect(await view.findByText('✓ Đã lưu')).toBeTruthy()
})
it('shows request failure inline for both fields and keeps the draft', async () => {
  mockUpdateProfile.mockRejectedValueOnce(new Error('failed'))
  const view = await mount()
  await type(view, NAME, 'Bình')
  await fireEvent.press(view.getByText('Lưu'))
  expect(await view.findAllByText('Chưa lưu được. Thử lại nhé.')).toHaveLength(2)
  expect(view.getByLabelText(NAME).props.value).toBe('Bình')
})
it('prevents duplicate saves and editing/back during the request', async () => {
  let answer!: (value: Me) => void
  mockUpdateProfile.mockImplementation(() => new Promise<Me>(resolve => { answer = resolve }))
  const view = await mount()
  await type(view, INPUT, '01/01/2000')
  const save = view.getByRole('button', { name: 'Lưu' })
  type Fiber = { memoizedProps?: { onPress?: () => void } | null; return: Fiber | null }
  let fiber = (save as unknown as { unstable_fiber: Fiber | null }).unstable_fiber
  while (fiber && !fiber.memoizedProps?.onPress) fiber = fiber.return
  const onPress = fiber?.memoizedProps?.onPress
  if (!onPress) throw new Error('missing save handler')
  await act(async () => { onPress(); onPress() })
  expect(mockUpdateProfile).toHaveBeenCalledTimes(1)
  expect(view.getByRole('button', { name: 'Lưu' }).props.accessibilityState.busy).toBe(true)
  expect(view.getByLabelText(INPUT).props.editable).toBe(false)
  expect(view.getByRole('button', { name: 'Quay lại' }).props.accessibilityState.disabled).toBe(true)
  await act(async () => { answer(profile({ dateOfBirth: '2000-01-01' })) })
  expect(await view.findByText('✓ Đã lưu')).toBeTruthy()
})
it('asks before discarding changes on back, and cancel keeps the draft', async () => {
  const view = await mount()
  await type(view, NAME, 'Bình')
  await fireEvent.press(view.getByRole('button', { name: 'Quay lại' }))
  expect(await view.findByText('Thay đổi chưa lưu')).toBeTruthy()
  await fireEvent.press(view.getByText('Tiếp tục sửa'))
  expect(mockBack).not.toHaveBeenCalled()
  await fireEvent.press(view.getByRole('button', { name: 'Quay lại' }))
  await fireEvent.press(view.getByText('Bỏ thay đổi'))
  expect(mockBack).toHaveBeenCalledTimes(1)
})
it.each([
  { dateOfBirth: null, draft: '31/02/2000' },
  { dateOfBirth: '2000-01-01', draft: '2000-01-01' },
])('asks before discarding an invalid birthday draft ($draft)', async ({ dateOfBirth, draft }) => {
  const view = await mount(profile({ dateOfBirth }))
  await type(view, INPUT, draft)
  await fireEvent.press(view.getByRole('button', { name: 'Quay lại' }))
  expect(await view.findByText('Thay đổi chưa lưu')).toBeTruthy()
  expect(mockBack).not.toHaveBeenCalled()
})
it('keeps an untouched field refetched during save when resetting the saved draft', async () => {
  let answer!: (value: Me) => void
  mockUpdateProfile.mockImplementation(() => new Promise<Me>(resolve => { answer = resolve }))
  const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
  await type(view, INPUT, '01/01/2000')
  await fireEvent.press(view.getByText('Lưu'))
  expect(mockUpdateProfile).toHaveBeenCalledWith({ dateOfBirth: '2000-01-01' })
  await refetch({ displayName: 'Server name' })
  expect(view.getByLabelText(NAME).props.value).toBe('Server name')
  await act(async () => { server = { ...server, dateOfBirth: '2000-01-01' }; answer(server) })
  expect(await view.findByText('✓ Đã lưu')).toBeTruthy()
  expect(view.getByLabelText(NAME).props.value).toBe('Server name')
  expect(view.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(true)
})
it('resets drafts on account change and ignores the old late response', async () => {
  let answer!: (value: Me) => void
  mockUpdateProfile.mockImplementation(() => new Promise<Me>(resolve => { answer = resolve }))
  const view = await mount()
  await type(view, NAME, 'Old draft')
  await fireEvent.press(view.getByText('Lưu'))
  await act(async () => { server = profile({ id: 'user-b', displayName: 'Bình', dateOfBirth: '1985-11-03' }); client.setQueryData(queryKeys.me(), server) })
  expect(view.getByLabelText(NAME).props.value).toBe('Bình')
  await act(async () => { answer(profile({ displayName: 'Old draft' })) })
  await waitFor(() => expect(view.getByLabelText(INPUT).props.value).toBe('03/11/1985'))
  expect(view.queryByText('✓ Đã lưu')).toBeNull()
})

type Node = { props: { fill?: { payload?: number } }; children: (Node | string)[] }
const fills = (node: Node): (number | undefined)[] => [node.props.fill?.payload, ...node.children.flatMap(child => typeof child === 'string' ? [] : fills(child))]
it.each(['orange', 'orangeDark'] as const)('uses token colors and a 44pt avatar edit target in %s with English copy', async name => {
  const theme = themes[name]
  UnistylesSheet.configure({ themes: { [name]: theme } as unknown as typeof themes })
  await act(async () => { await i18n.changeLanguage('en') })
  const view = await mount(profile({ email: 'an@example.test' }))
  const badge = view.getByRole('button', { name: 'Change profile picture' })
  const style = StyleSheet.flatten(badge.props.style)
  expect(style.width).toBeGreaterThanOrEqual(44)
  expect(style.height).toBeGreaterThanOrEqual(44)
  expect(StyleSheet.flatten(view.getByTestId('avatar-edit-badge').props.style).backgroundColor).toBe(theme.accent.primary)
  expect(fills(within(badge).getByTestId('material-icon-edit', { includeHiddenElements: true }) as unknown as Node)).toContain(processColor(theme.accent.onAccent))
  expect(view.getByRole('button', { name: 'Save' })).toBeTruthy()
  expect(view.getByRole('header', { name: 'Personal information' })).toBeTruthy()
  expect(view.getByTestId('material-icon-lock', { includeHiddenElements: true })).toBeTruthy()
  expect(view.getByText('Fixed')).toBeTruthy()
  expect(view.getByText(i18n.t('account.dobBody'))).toBeTruthy()
})

async function openBirthday(view: View) {
  await fireEvent(view.getByLabelText(INPUT), 'pressIn')
  return within(await view.findByTestId('birthday-sheet'))
}
async function wheel(view: View, part: 'day' | 'month' | 'year', value: number) {
  await fireEvent(view.getByTestId(`birthday-wheel-${part}`, { includeHiddenElements: true }), 'momentumScrollEnd', { nativeEvent: { contentOffset: { y: (value - 1) * 44 } } })
}
it('settles wheel batching and sheet dismissal on the controlled clock', async () => {
  const view = await mount(profile({ dateOfBirth: '2000-02-29' }))
  const sheet = await openBirthday(view)
  await wheel(view, 'year', 2001)
  // Cross several list batches and animation frames while the picker is open.
  await act(async () => { jest.advanceTimersByTime(motion.standard + 100) })
  expect(sheet.getByRole('adjustable', { name: 'Ngày' }).props.accessibilityValue.now).toBe(28)
  await fireEvent.press(sheet.getByRole('button', { name: 'Xác nhận' }))
  expect(view.getByLabelText(INPUT).props.value).toBe('28/02/2001')
  // Closing hides accessibility immediately, but the real exit still runs.
  expect(view.queryByTestId('birthday-sheet')).toBeNull()
  expect(view.getByTestId('birthday-sheet', { includeHiddenElements: true })).toBeTruthy()
  await act(async () => { jest.advanceTimersByTime(motion.standard + 100) })
  expect(view.queryByTestId('birthday-sheet', { includeHiddenElements: true })).toBeNull()
  expect(mockUpdateProfile).not.toHaveBeenCalled()
})
it('opens Stitch wheels from the field and confirms only a form draft until header Save', async () => {
  const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
  const sheet = await openBirthday(view)
  expect(sheet.getByRole('header', { name: 'Chọn ngày sinh' })).toBeTruthy()
  expect(sheet.getByText('Chỉ bạn thấy thông tin này')).toBeTruthy()
  expect(sheet.getByText('17 tháng 05, 1990')).toBeTruthy()
  expect(view.getByLabelText(INPUT).props.showSoftInputOnFocus).toBe(false)
  await wheel(view, 'year', 2000)
  await wheel(view, 'month', 2)
  await wheel(view, 'day', 29)
  expect(mockUpdateProfile).not.toHaveBeenCalled()
  await fireEvent.press(sheet.getByRole('button', { name: 'Xác nhận' }))
  expect(view.getByLabelText(INPUT).props.value).toBe('29/02/2000')
  expect(mockUpdateProfile).not.toHaveBeenCalled()
  await fireEvent.press(view.getByRole('button', { name: 'Lưu' }))
  expect(mockUpdateProfile).toHaveBeenCalledWith({ dateOfBirth: '2000-02-29' })
})
it.each(['cancel', 'close', 'backdrop', 'back', 'escape'] as const)('discards only the picker draft on %s and reopens at the form value', async action => {
  const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
  await type(view, INPUT, '01/01/2000')
  const sheet = await openBirthday(view)
  await wheel(view, 'year', 1980)
  if (action === 'cancel') await fireEvent.press(sheet.getByRole('button', { name: 'Huỷ' }))
  if (action === 'close') await fireEvent.press(sheet.getByRole('button', { name: 'Đóng' }))
  if (action === 'backdrop') await fireEvent.press(within(view.getByTestId('sheet-backdrop')).getByRole('button', { name: 'Đóng' }))
  if (action === 'back') await fireEvent(view.getByTestId('birthday-sheet-modal'), 'requestClose')
  if (action === 'escape') await fireEvent(view.getByTestId('birthday-sheet'), 'accessibilityEscape')
  expect(view.getByLabelText(INPUT).props.value).toBe('01/01/2000')
  expect(mockUpdateProfile).not.toHaveBeenCalled()
  const reopened = await openBirthday(view)
  expect(reopened.getByRole('adjustable', { name: 'Năm' }).props.accessibilityValue.now).toBe(2000)
})
it('clamps leap days and short months, and supports screen reader adjustments and decade shortcuts', async () => {
  const view = await mount(profile({ dateOfBirth: '2000-02-29' }))
  const sheet = await openBirthday(view)
  await fireEvent(sheet.getByRole('adjustable', { name: 'Năm' }), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } })
  expect(sheet.getByRole('adjustable', { name: 'Ngày' }).props.accessibilityValue.now).toBe(28)
  await fireEvent.press(sheet.getByRole('button', { name: '- 10 năm' }))
  expect(sheet.getByRole('adjustable', { name: 'Năm' }).props.accessibilityValue.now).toBe(1991)
  await fireEvent.press(sheet.getByRole('button', { name: '+ 10 năm' }))
  expect(sheet.getByRole('adjustable', { name: 'Năm' }).props.accessibilityValue.now).toBe(2001)
  await wheel(view, 'month', 1)
  await wheel(view, 'day', 31)
  await wheel(view, 'month', 4)
  expect(sheet.getByRole('adjustable', { name: 'Ngày' }).props.accessibilityValue.now).toBe(30)
  await fireEvent.press(sheet.getByRole('button', { name: 'Xác nhận' }))
  expect(view.getByLabelText(INPUT).props.value).toBe('30/04/2001')
})
it('defaults an unset picker to Vietnam today, blocks future selections and clamps decade shortcuts', async () => {
  const view = await mount()
  const sheet = await openBirthday(view)
  const [year, month, day] = todayInVietnam().split('-').map(Number)
  expect(sheet.getByRole('adjustable', { name: 'Ngày' }).props.accessibilityValue.now).toBe(day)
  await wheel(view, 'year', year)
  await wheel(view, 'month', 12)
  await wheel(view, 'day', 31)
  if (month !== 12 || day !== 31) {
    expect(sheet.getByRole('button', { name: 'Xác nhận' }).props.accessibilityState.disabled).toBe(true)
    expect(sheet.getByText('Ngày sinh không thể sau hôm nay.')).toBeTruthy()
    await fireEvent.press(sheet.getByRole('button', { name: 'Xác nhận' }))
    expect(view.getByLabelText(INPUT).props.value).toBe('')
  }
  await fireEvent.press(sheet.getByRole('button', { name: '+ 10 năm' }))
  expect(sheet.getByRole('button', { name: 'Xác nhận' }).props.accessibilityState.disabled).toBe(false)
  await wheel(view, 'year', 1990)
  await fireEvent.press(sheet.getByRole('button', { name: 'Hôm nay' }))
  await fireEvent.press(sheet.getByRole('button', { name: 'Xác nhận' }))
  expect(view.getByLabelText(INPUT).props.value).toBe(`${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`)
})
it.each(['orange', 'orangeDark'] as const)('localizes the picker in English with semantic colors and accessible targets in %s', async name => {
  const theme = themes[name]
  UnistylesSheet.configure({ themes: { [name]: theme } as unknown as typeof themes })
  await act(async () => { await i18n.changeLanguage('en') })
  const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
  await fireEvent(view.getByLabelText('Date of birth (day/month/year)'), 'accessibilityTap')
  const sheet = within(await view.findByTestId('birthday-sheet'))
  expect(sheet.getByRole('header', { name: 'Choose date of birth' })).toBeTruthy()
  const summary = sheet.getByText('May 17, 1990')
  expect(StyleSheet.flatten(summary.props.style).color).toBe(theme.accent.text)
  const close = sheet.getByRole('button', { name: 'Close' })
  const closeStyle = StyleSheet.flatten(close.props.style)
  expect(closeStyle.width).toBeGreaterThanOrEqual(44)
  expect(closeStyle.height).toBeGreaterThanOrEqual(44)
  expect(sheet.getByRole('adjustable', { name: 'Day' })).toBeTruthy()
  expect(sheet.getByRole('adjustable', { name: 'Month' })).toBeTruthy()
  expect(sheet.getByRole('adjustable', { name: 'Year' })).toBeTruthy()
  expect(sheet.getByRole('button', { name: 'Today' })).toBeTruthy()
  expect(sheet.getByRole('button', { name: 'Confirm' })).toBeTruthy()
})

// The Unistyles Jest mock resolves styles once at import time. Isolate the style
// module per theme to verify the surfaces as well as the live Text tint above.
it.each(['orange', 'orangeDark'] as const)('resolves birthday sheet surfaces from %s tokens', name => {
  jest.isolateModules(() => {
    const unistyles = jest.requireMock('react-native-unistyles') as typeof import('react-native-unistyles')
    unistyles.StyleSheet.configure({ themes: { [name]: themes[name] } as unknown as typeof themes })
    const { styles } = jest.requireActual<typeof import('../account/birthday-sheet.style')>('../account/birthday-sheet.style')
    expect(styles.close.backgroundColor).toBe(themes[name].surface.card)
    expect(styles.picker.backgroundColor).toBe(themes[name].surface.card)
    expect(styles.summary.backgroundColor).toBe(themes[name].surface.subtle)
    expect(styles.selected.backgroundColor).toBe(themes[name].surface.subtle)
    for (const surface of [styles.close, styles.picker, styles.summary, styles.shortcut]) expect(surface.borderWidth).toBe(0)
  })
})
it('keeps picker changes out of form dirty state and cancels to the latest refetched value', async () => {
  const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
  const sheet = await openBirthday(view)
  await wheel(view, 'year', 2000)
  expect(view.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(true)
  await refetch({ dateOfBirth: '1985-11-03' })
  expect(sheet.getByRole('adjustable', { name: 'Năm' }).props.accessibilityValue.now).toBe(2000)
  await fireEvent.press(sheet.getByRole('button', { name: 'Huỷ' }))
  expect(view.getByLabelText(INPUT).props.value).toBe('03/11/1985')
  expect(view.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(true)
})
it('drops an open birthday picker on account change', async () => {
  const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
  await openBirthday(view)
  await wheel(view, 'year', 2000)
  await act(async () => { server = profile({ id: 'user-b', dateOfBirth: '1985-11-03' }); client.setQueryData(queryKeys.me(), server) })
  expect(view.queryByTestId('birthday-sheet')).toBeNull()
  expect(view.getByLabelText(INPUT).props.value).toBe('03/11/1985')
  expect(view.getByRole('button', { name: 'Lưu' }).props.accessibilityState.disabled).toBe(true)
})
it('confirms the current wheel row even before scroll momentum ends', async () => {
  const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
  const sheet = await openBirthday(view)
  await fireEvent(view.getByTestId('birthday-wheel-day', { includeHiddenElements: true }), 'scroll', { timeStamp: 1, nativeEvent: { contentOffset: { x: 0, y: 17 * 44 }, contentSize: { width: 100, height: 33 * 44 }, layoutMeasurement: { width: 100, height: 132 } } })
  expect(sheet.getByText('18 tháng 05, 1990')).toBeTruthy()
  await fireEvent.press(sheet.getByRole('button', { name: 'Xác nhận' }))
  expect(view.getByLabelText(INPUT).props.value).toBe('18/05/1990')
  expect(mockUpdateProfile).not.toHaveBeenCalled()
})
