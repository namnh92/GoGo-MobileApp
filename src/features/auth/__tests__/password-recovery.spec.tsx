import { act, fireEvent, renderHook, screen, waitFor } from '@testing-library/react-native'
import { AppState, StyleSheet as NativeStyleSheet, type AppStateStatus } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { render } from '@/shared/ui/__tests__/query-render'
import i18n from '@/shared/i18n'
import { themes } from '@/shared/ui/theme'
import * as Crypto from 'expo-crypto'
import { getSession } from '@/shared/api/session'
import ForgotPassword from '../forgot-password.view'
import ResetPassword from '../reset-password.view'
import SignIn from '../sign-in.view'
import { useRecoveryCountdown, useRecoveryFlow, useRecoveryRequests } from '../password-recovery'

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() }
let mockParams: { recovered?: string; next?: string } = {}
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: unknown }) => { mockRouter.replace(href); return null },
}))
jest.mock('@/shared/providers/session-provider', () => ({ useSession: () => ({ signIn: jest.fn(), signUp: jest.fn() }) }))

const fetchMock = jest.fn()
const originalFetch = global.fetch
const challenge = (id = '00000000-0000-4000-8000-000000000001') => ({
  challengeId: id, expiresAt: new Date(Date.now() + 300_000).toISOString(), resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
})
function response(status: number, body?: unknown, retryAfter?: string) {
  return { ok: status >= 200 && status < 300, status,
    headers: { get: (name: string) => name === 'retry-after' ? retryAfter ?? null : 'application/json' },
    text: async () => JSON.stringify(body), json: async () => body,
  }
}
const button = (label: string) => screen.getByRole('button', { name: label })
const digit = (n: number) => screen.getByLabelText(`Chữ số ${n} trong 6 chữ số`)
const errorBody = (code: string) => ({ code, message: 'NEVER DISPLAY server/account details', field_errors: [], retryable: false })
async function fillReset() {
  await fireEvent.changeText(digit(1), '123456')
  await fireEvent.changeText(screen.getByLabelText('Mật khẩu mới'), 'GoGo2026!')
}
function seedFlow(resendAt = Date.now() + 60_000) {
  useRecoveryFlow.getState().setFlow({ email: 'binh@example.com', ...challenge(), ...(resendAt < Date.now() ? { expiresAt: new Date(resendAt).toISOString() } : {}), resendAvailableAt: new Date(resendAt).toISOString() })
}
beforeEach(async () => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  useRecoveryRequests.setState({ emails: {} })
  let intentNumber = 0
  jest.spyOn(Crypto, 'randomUUID').mockImplementation(() => `00000000-0000-4000-8000-${String(++intentNumber).padStart(12, '0')}`)
  mockParams = {}
  useRecoveryFlow.getState().setFlow(null)
  fetchMock.mockReset().mockResolvedValue(response(202, challenge()))
  global.fetch = fetchMock
  await i18n.changeLanguage('vi')
})
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); StyleSheet.configure({ themes }) })
afterAll(() => { global.fetch = originalFetch })

it('validates email, loads inside the send button, navigates only after 202, and keeps email out of the route', async () => {
  let resolve!: (value: unknown) => void
  fetchMock.mockImplementation(() => new Promise(done => { resolve = done }))
  await render(<ForgotPassword />)
  expect(screen.getByLabelText('Email').props.placeholder).toBeUndefined()
  expect(button('Gửi mã').props.accessibilityState.disabled).toBe(true)
  await fireEvent.changeText(screen.getByLabelText('Email'), 'invalid')
  expect(button('Gửi mã').props.accessibilityState.disabled).toBe(true)
  expect(screen.queryByText('Email chưa đúng định dạng.')).toBeNull()
  await fireEvent(screen.getByLabelText('Email'), 'blur')
  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.getByText('Email chưa đúng định dạng.')).toBeTruthy()
  await fireEvent.changeText(screen.getByLabelText('Email'), ' binh@example.com ')
  await fireEvent.press(button('Gửi mã'))
  expect(button('Gửi mã').props.accessibilityState).toEqual({ busy: true, disabled: true })
  expect(screen.getByLabelText('Email').props.editable).toBe(false)
  expect(mockRouter.push).not.toHaveBeenCalled()
  await act(async () => { resolve(response(202, challenge())) })
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/auth/reset-password'))
  const [url, options] = fetchMock.mock.calls[0]
  expect(url).toMatch(/\/v1\/auth\/password-recovery\/request$/)
  expect(JSON.parse(options.body)).toEqual({ email: 'binh@example.com' })
  expect(options.headers['idempotency-key']).toMatch(/^[\w-]{8,128}$/)
  expect(options.headers.authorization).toBeUndefined()
  expect(useRecoveryFlow.getState().flow?.challengeId).toBe(challenge().challengeId)
  expect(screen.getByText('Mã hết hạn sau 5 phút.')).toBeTruthy()
})

it.each([
  [503, 'RECOVERY_MAIL_NOT_CONFIGURED', 'GoGo chưa cấu hình dịch vụ gửi email khôi phục. Vui lòng thử lại sau.'],
  [503, 'RECOVERY_UNAVAILABLE', 'Dịch vụ khôi phục mật khẩu tạm thời không khả dụng. Vui lòng thử lại sau.'],
  [429, 'RATE_LIMITED', 'Bạn đã thử quá nhiều lần. Vui lòng chờ trước khi thử lại.'],
])('keeps request failures on the email screen (%s %s)', async (status, code, copy) => {
  fetchMock.mockResolvedValue(response(status, errorBody(code), status === 429 ? '3600' : undefined))
  await render(<ForgotPassword />)
  await fireEvent.changeText(screen.getByLabelText('Email'), 'absent@example.com')
  await fireEvent.press(button('Gửi mã'))
  expect(await screen.findByText(copy)).toBeTruthy()
  expect(mockRouter.push).not.toHaveBeenCalled()
  expect(useRecoveryFlow.getState().flow).toBeNull()
  expect(screen.queryByText(/NEVER DISPLAY/)).toBeNull()
  if (status === 429) {
    expect(button('Gửi mã').props.accessibilityState.disabled).toBe(true)
    expect(screen.getByText('Gửi lại mã sau 60:00')).toBeTruthy()
  }
})

it('shows offline, never auto-retries, and reuses the intent key on manual retry', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValue(response(202, challenge()))
  await render(<ForgotPassword />)
  await fireEvent.changeText(screen.getByLabelText('Email'), 'binh@example.com')
  await fireEvent.press(button('Gửi mã'))
  await waitFor(() => expect(button('Gửi mã').props.accessibilityState.busy).toBe(false))
  expect(mockRouter.push).not.toHaveBeenCalled()
  expect(screen.getByText(i18n.t('auth.networkError'))).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(button('Gửi mã').props.accessibilityState.disabled).toBe(true)
  await act(async () => { jest.advanceTimersByTime(60_000) })
  await fireEvent.press(button('Gửi mã'))
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalled())
  expect(fetchMock.mock.calls[0][1].headers['idempotency-key']).toBe(fetchMock.mock.calls[1][1].headers['idempotency-key'])
})

it.each(['orange', 'orangeDark'] as const)('masks email and uses role tokens and accessible OTP boxes in %s', async themeName => {
  StyleSheet.configure({ themes: { [themeName]: themes[themeName] } as unknown as typeof themes })
  seedFlow()
  await render(<ResetPassword />)
  expect(screen.getByText(/b\*\*\*@example.com/)).toBeTruthy()
  expect(screen.queryByText(/binh@example.com/)).toBeNull()
  expect(screen.getByText('Gửi lại mã sau 1:00')).toBeTruthy()
  for (let i = 1; i <= 6; i++) expect(digit(i)).toBeTruthy()
  const box = NativeStyleSheet.flatten(digit(1).props.style)
  expect(box).toMatchObject({ width: 48, height: 54 })
  // Unistyles' Jest mock resolves sheets once on import. Resolve a fresh sheet
  // under each theme; native runtime switching remains an owner simulator check.
  jest.isolateModules(() => {
    const { StyleSheet: sheet } = jest.requireMock<typeof import('react-native-unistyles')>('react-native-unistyles')
    sheet.configure({ themes: { [themeName]: themes[themeName] } as unknown as typeof themes })
    const { styles: resolved } = jest.requireActual<typeof import('../password-recovery.style')>('../password-recovery.style')
    expect(resolved.digit).toMatchObject({ color: themes[themeName].text.primary, backgroundColor: themes[themeName].surface.card })
    expect(resolved.digitFocused.borderColor).toBe(themes[themeName].accent.primary)
  })
  const headings = screen.getAllByText('Đặt lại mật khẩu')
  expect(NativeStyleSheet.flatten(headings[0].props.style)).toMatchObject({ textAlign: 'center', color: themes[themeName].accent.text })
  expect(screen.queryByRole('button', { name: 'Gửi lại mã' })).toBeNull()
  await fillReset()
  for (let i = 1; i <= 6; i++) expect(digit(i).props.value).toBe(String(i))
  expect(screen.getByLabelText('Mật khẩu mới').props.secureTextEntry).toBe(true)
  await fireEvent.press(button('Hiện mật khẩu'))
  expect(screen.getByLabelText('Mật khẩu mới').props.secureTextEntry).toBe(false)
  for (const rule of ['length', 'upper', 'lower', 'digit', 'special']) expect(screen.getByTestId(`password-requirement-${rule}`).props.accessibilityLabel).toMatch(/^Đã đạt:/)
})

it('uses absolute deadlines on foreground resume', async () => {
  let foreground!: (state: AppStateStatus) => void
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    foreground = callback
    return { remove: jest.fn() }
  })
  const now = Date.now()
  const clock = jest.spyOn(Date, 'now').mockReturnValue(now)
  const hook = await renderHook(() => useRecoveryCountdown(now + 60_000))
  expect(hook.result.current).toBe(60)
  clock.mockReturnValue(now + 45_000)
  await act(() => foreground('active'))
  expect(hook.result.current).toBe(15)
  clock.mockReturnValue(now + 80_000)
  await act(() => foreground('active'))
  expect(hook.result.current).toBe(0)
})

it('resends with a fresh intent, replaces challenge, clears old code, restarts cooldown', async () => {
  seedFlow(Date.now() - 1)
  await render(<ResetPassword />)
  await fillReset()
  const newChallenge = challenge('00000000-0000-4000-8000-000000000002')
  fetchMock.mockResolvedValueOnce(response(202, newChallenge))
  await fireEvent.press(button('Gửi lại mã'))
  await waitFor(() => expect(useRecoveryFlow.getState().flow?.challengeId).toBe(newChallenge.challengeId))
  for (let i = 1; i <= 6; i++) expect(digit(i).props.value).toBe('')
  expect(screen.getByText('Gửi lại mã sau 1:00')).toBeTruthy()
  await fillReset()
  fetchMock.mockResolvedValueOnce(response(204))
  const previousSession = getSession()
  await fireEvent.press(button('Đặt lại mật khẩu'))
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/auth/sign-in', params: { recovered: '1' } }))
  const [url, options] = fetchMock.mock.calls[1]
  expect(url).toMatch(/\/auth\/password-recovery\/complete$/)
  expect(JSON.parse(options.body)).toEqual({ email: 'binh@example.com', challengeId: newChallenge.challengeId, code: '123456', password: 'GoGo2026!' })
  expect(options.headers.authorization).toBeUndefined()
  expect(getSession()).toBe(previousSession)
})

it.each(['RECOVERY_INVALID', 'RECOVERY_MAIL_NOT_CONFIGURED', 'RECOVERY_UNAVAILABLE', 'RATE_LIMITED'])('handles completion error %s without navigating or disclosing account details', async code => {
  seedFlow()
  fetchMock.mockResolvedValue(response(code === 'RECOVERY_INVALID' ? 400 : code === 'RATE_LIMITED' ? 429 : 503, errorBody(code)))
  await render(<ResetPassword />)
  await fillReset()
  await fireEvent.press(button('Đặt lại mật khẩu'))
  await waitFor(() => expect(button('Đặt lại mật khẩu').props.accessibilityState.busy).toBe(false))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(mockRouter.replace).not.toHaveBeenCalled()
  expect(screen.queryByText(/NEVER DISPLAY/)).toBeNull()
  if (code === 'RECOVERY_INVALID') expect(screen.getByText('Mã sai hoặc đã hết hạn. Vui lòng kiểm tra hoặc gửi lại mã.')).toBeTruthy()
  if (code === 'RATE_LIMITED') expect(button('Đặt lại mật khẩu').props.accessibilityState.disabled).toBe(true)
})

it('does not submit incomplete codes or weak passwords', async () => {
  seedFlow()
  await render(<ResetPassword />)
  await fireEvent.changeText(screen.getByLabelText('Mật khẩu mới'), 'GoGo2026!')
  await fireEvent.press(button('Đặt lại mật khẩu'))
  expect(screen.getByText('Nhập đủ mã gồm 6 chữ số.')).toBeTruthy()
  await fireEvent.changeText(digit(1), '123456')
  await fireEvent.changeText(screen.getByLabelText('Mật khẩu mới'), 'weak')
  await fireEvent.press(button('Đặt lại mật khẩu'))
  expect(fetchMock).not.toHaveBeenCalled()
})

it('shows the reset success message at sign in in both locales', async () => {
  mockParams = { recovered: '1' }
  const view = await render(<SignIn />)
  expect(screen.getByText('Đã đổi mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới.')).toBeTruthy()
  await act(async () => { await i18n.changeLanguage('en') })
  expect(screen.getByText('Password changed. Please sign in with your new password.')).toBeTruthy()
  await view.unmount()
})

it('redirects direct reset entry without a private challenge back to the request screen', async () => {
  await render(<ResetPassword />)
  expect(mockRouter.replace).toHaveBeenCalledWith('/auth/forgot-password')
  expect(fetchMock).not.toHaveBeenCalled()
})


it.each([503, 429])('preserves the current proof after resend failure %s', async status => {
  seedFlow(Date.now() - 1)
  const previous = useRecoveryFlow.getState().flow
  fetchMock.mockResolvedValue(response(status, errorBody(status === 429 ? 'RATE_LIMITED' : 'RECOVERY_MAIL_NOT_CONFIGURED')))
  await render(<ResetPassword />)
  await fillReset()
  await fireEvent.press(button('Gửi lại mã'))
  await waitFor(() => expect(screen.getByLabelText('Mật khẩu mới').props.editable).toBe(true))
  expect(useRecoveryFlow.getState().flow).toBe(previous)
  expect(digit(1).props.value).toBe('1')
  expect(mockRouter.replace).not.toHaveBeenCalled()
  if (status === 429) expect(button('Gửi lại mã').props.accessibilityState.disabled).toBe(true)
  else expect(screen.getByText(i18n.t('auth.recovery.mailNotConfigured'))).toBeTruthy()
})

it('enables resend after code expiry even after background time', async () => {
  const listeners: (() => void)[] = []
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    listeners.push(() => callback('active'))
    return { remove: jest.fn() }
  })
  const now = Date.now()
  const clock = jest.spyOn(Date, 'now').mockReturnValue(now)
  seedFlow(now + 60_000)
  await render(<ResetPassword />)
  expect(screen.queryByRole('button', { name: 'Gửi lại mã' })).toBeNull()
  clock.mockReturnValue(now + 300_000)
  await act(() => listeners.forEach(notify => notify()))
  expect(button('Gửi lại mã').props.accessibilityState.disabled).toBe(false)
})

it('retries an ambiguous completion with the same key and clears private flow on unmount', async () => {
  seedFlow()
  fetchMock.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(response(204))
  const view = await render(<ResetPassword />)
  await fillReset()
  await fireEvent.press(button('Đặt lại mật khẩu'))
  expect(await screen.findByText(i18n.t('auth.networkError'))).toBeTruthy()
  expect(mockRouter.replace).not.toHaveBeenCalled()
  await fireEvent.press(button('Đặt lại mật khẩu'))
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/auth/sign-in', params: { recovered: '1' } }))
  expect(fetchMock.mock.calls[0][1].headers['idempotency-key']).toBe(fetchMock.mock.calls[1][1].headers['idempotency-key'])
  await view.unmount()
  expect(useRecoveryFlow.getState().flow).toBeNull()
})


it('counts down API expiry, hides resend until zero, and prevents completing expired codes', async () => {
  seedFlow()
  await render(<ResetPassword />)
  await fillReset()
  expect(screen.getByText('Mã hết hạn sau 5:00')).toBeTruthy()
  await act(async () => { jest.advanceTimersByTime(1000) })
  expect(screen.getByText('Mã hết hạn sau 4:59')).toBeTruthy()
  await act(async () => { jest.advanceTimersByTime(60_000) })
  expect(screen.queryByRole('button', { name: 'Gửi lại mã' })).toBeNull()
  await act(async () => { jest.advanceTimersByTime(238_000) })
  expect(screen.getByText('Mã hết hạn sau 0:01')).toBeTruthy()
  expect(button('Đặt lại mật khẩu').props.accessibilityState.disabled).toBe(false)
  await act(async () => { jest.advanceTimersByTime(1000) })
  expect(screen.getByText('Mã đã hết hạn. Vui lòng gửi lại mã.')).toBeTruthy()
  expect(button('Gửi lại mã').props.accessibilityState.disabled).toBe(false)
  expect(button('Đặt lại mật khẩu').props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(button('Đặt lại mật khẩu'))
  expect(fetchMock).not.toHaveBeenCalled()
  await act(async () => { await i18n.changeLanguage('en') })
  expect(screen.getByText('The code has expired. Please request a new code.')).toBeTruthy()
})

it('uses the API expiry without restarting the five minutes on mount', async () => {
  seedFlow()
  await act(async () => { jest.advanceTimersByTime(42_000) })
  await render(<ResetPassword />)
  expect(screen.getByText('Mã hết hạn sau 4:18')).toBeTruthy()
})

it('counts the initial request and two resends per email and unlocks when the first request ages out', async () => {
  fetchMock.mockImplementation(async () => response(202, challenge()))
  const forgot = await render(<ForgotPassword />)
  await fireEvent.changeText(screen.getByLabelText('Email'), 'binh@example.com')
  await fireEvent.press(button('Gửi mã'))
  await waitFor(() => expect(mockRouter.push).toHaveBeenCalled())
  await forgot.unmount()
  const reset = await render(<ResetPassword />)
  for (let count = 2; count <= 3; count++) {
    await act(async () => { jest.advanceTimersByTime(300_000) })
    await fireEvent.press(button('Gửi lại mã'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(count))
    await waitFor(() => expect(screen.getByText('Mã hết hạn sau 5:00')).toBeTruthy())
  }
  expect(screen.getByText('Gửi lại mã sau 50:00')).toBeTruthy()
  await act(async () => { jest.advanceTimersByTime(300_000) })
  expect(button('Gửi lại mã').props.accessibilityState.disabled).toBe(true)
  expect(screen.getByText('Gửi lại mã sau 45:00')).toBeTruthy()
  await fireEvent.press(button('Gửi lại mã'))
  expect(fetchMock).toHaveBeenCalledTimes(3)
  await reset.unmount()
  // Leaving the reset route cannot bypass the session quota; normalized emails share it.
  await render(<ForgotPassword />)
  await fireEvent.changeText(screen.getByLabelText('Email'), 'BINH@example.com')
  expect(button('Gửi mã').props.accessibilityState.disabled).toBe(true)
  await fireEvent.changeText(screen.getByLabelText('Email'), 'other@example.com')
  expect(button('Gửi mã').props.accessibilityState.disabled).toBe(false)
  await fireEvent.changeText(screen.getByLabelText('Email'), 'binh@example.com')
  await act(async () => { jest.advanceTimersByTime(2_699_000) })
  expect(button('Gửi mã').props.accessibilityState.disabled).toBe(true)
  await act(async () => { jest.advanceTimersByTime(1000) })
  expect(button('Gửi mã').props.accessibilityState.disabled).toBe(false)
})

it.each(['120', 'http-date', undefined])('blocks expired-code resend after 429 using Retry-After %s', async retryAfter => {
  seedFlow(Date.now() - 1)
  fetchMock.mockResolvedValueOnce(response(429, errorBody('RATE_LIMITED'), retryAfter === 'http-date' ? new Date(Date.now() + 120_000).toUTCString() : retryAfter))
  await render(<ResetPassword />)
  await fireEvent.press(button('Gửi lại mã'))
  expect(await screen.findByText(i18n.t('auth.recovery.rateLimited'))).toBeTruthy()
  expect(button('Gửi lại mã').props.accessibilityState.disabled).toBe(true)
  expect(button('Đặt lại mật khẩu').props.accessibilityState.disabled).toBe(true)
  const wait = retryAfter ? 120_000 : 60_000
  expect(screen.getByText(`Gửi lại mã sau ${retryAfter ? '2:00' : '1:00'}`)).toBeTruthy()
  await act(async () => { jest.advanceTimersByTime(wait - 1000) })
  expect(button('Gửi lại mã').props.accessibilityState.disabled).toBe(true)
  await act(async () => { jest.advanceTimersByTime(1000) })
  expect(button('Gửi lại mã').props.accessibilityState.disabled).toBe(false)
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('validates an invalid email on keyboard submit', async () => {
  await render(<ForgotPassword />)
  await fireEvent.changeText(screen.getByLabelText('Email'), 'invalid')
  await fireEvent(screen.getByLabelText('Email'), 'submitEditing')
  expect(screen.getByText('Email chưa đúng định dạng.')).toBeTruthy()
  expect(fetchMock).not.toHaveBeenCalled()
})
