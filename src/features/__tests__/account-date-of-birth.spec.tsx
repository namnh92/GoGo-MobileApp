import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, waitFor, within } from '@testing-library/react-native'
import { StyleSheet, processColor } from 'react-native'
import { StyleSheet as UnistylesSheet } from 'react-native-unistyles'
import { themes } from '@/shared/ui/theme'
import i18n from '@/shared/i18n'
import { renderScreen } from './harness'

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
  expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: 'Bình', dateOfBirth: '1990-05-17' })
})
it('clears the birthday as a draft, then saves null with the header action', async () => {
  const view = await mount(profile({ dateOfBirth: '1990-05-17' }))
  await fireEvent.press(view.getByText('Xoá ngày sinh'))
  expect(mockUpdateProfile).not.toHaveBeenCalled()
  await fireEvent.press(view.getByText('Lưu'))
  expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: 'An', dateOfBirth: null })
  expect(await view.findByText('Chưa đặt ngày sinh')).toBeTruthy()
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
  const view = await mount()
  const badge = view.getByRole('button', { name: 'Change profile picture' })
  const style = StyleSheet.flatten(badge.props.style)
  expect(style.width).toBeGreaterThanOrEqual(44)
  expect(style.height).toBeGreaterThanOrEqual(44)
  expect(style.backgroundColor).toBe(theme.accent.primary)
  expect(fills(within(badge).getByTestId('material-icon-edit', { includeHiddenElements: true }) as unknown as Node)).toContain(processColor(theme.accent.onAccent))
  expect(view.getByRole('button', { name: 'Save' })).toBeTruthy()
})
