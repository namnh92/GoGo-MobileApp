import { act, fireEvent, renderHook, screen, waitFor, within } from '@testing-library/react-native'
import { AppState, Keyboard, ScrollView, TextInput as NativeTextInput, View, StyleSheet as NativeStyleSheet, type AppStateStatus, type KeyboardEvent, type KeyboardEventName } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { render } from '@/shared/ui/__tests__/query-render'
import i18n from '@/shared/i18n'
import { themes } from '@/shared/ui/theme'
import * as Crypto from 'expo-crypto'
import { getSession } from '@/shared/api/session'
import type { RecoveryAccountNotFoundResponse } from '@/shared/api/endpoints/password-recovery'
import ForgotPassword from '../forgot-password.view'
import ResetPassword from '../reset-password.view'
import { useRecoveryCountdown, useRecoveryFlow, useRecoveryRequests } from '../password-recovery'

const mockNavigation = { reset: jest.fn() }
const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() }
let mockParams: { recovered?: string; next?: string } = {}
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useNavigation: () => mockNavigation,
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
const accountNotFoundBody = {
  code: 'RECOVERY_ACCOUNT_NOT_FOUND', message: 'Tài khoản không tồn tại',
  field_errors: [], request_id: 'recovery-request', retryable: false,
} satisfies RecoveryAccountNotFoundResponse
async function fillReset() {
  await fireEvent.changeText(screen.getByLabelText('Mật khẩu mới'), 'GoGo2026!')
  await fireEvent.changeText(screen.getByLabelText('Nhập lại mật khẩu mới'), 'GoGo2026!')
}
function seedFlow(resendAt = Date.now() + 60_000, code: string | null = "123456") {
  useRecoveryFlow.getState().setFlow({ email: 'binh@example.com', code: code ?? undefined, ...challenge(), ...(resendAt < Date.now() ? { expiresAt: new Date(resendAt).toISOString() } : {}), resendAvailableAt: new Date(resendAt).toISOString() })
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

it('validates email, loads inside the send button, stays on 202, and advances only after six digits', async () => {
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
  await waitFor(() => expect(screen.queryByLabelText('Email')).toBeNull())
  const [url, options] = fetchMock.mock.calls[0]
  expect(url).toMatch(/\/v1\/auth\/password-recovery\/request$/)
  expect(JSON.parse(options.body)).toEqual({ email: 'binh@example.com' })
  expect(options.headers['idempotency-key']).toMatch(/^[\w-]{8,128}$/)
  expect(options.headers.authorization).toBeUndefined()
  expect(useRecoveryFlow.getState().flow?.challengeId).toBe(challenge().challengeId)
  expect(screen.queryByText('Mã hết hạn sau 5 phút.')).toBeNull()
  expect(screen.queryByText('Quay lại đăng nhập')).toBeNull()
  expect(mockRouter.replace).not.toHaveBeenCalled()
  expect(screen.getByText('Mã đã gửi tới b***@example.com')).toBeTruthy()
  await fireEvent.changeText(digit(1), '12345')
  expect(mockRouter.replace).not.toHaveBeenCalled()
  fetchMock.mockResolvedValueOnce(response(204))
  await fireEvent.changeText(digit(6), '6')
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/auth/reset-password'))
  expect(mockRouter.replace).toHaveBeenCalledWith('/auth/reset-password')
  expect(useRecoveryFlow.getState().flow?.code).toBe('123456')
})

it.each([
  ['vi', 'Nhập email đã đăng ký. GoGo sẽ gửi mã 6 số để bạn đặt lại mật khẩu.', 'Tài khoản không tồn tại.', 'Gửi mã'],
  ['en', 'Enter your registered email. GoGo will send a 6-digit password reset code.', 'Account does not exist.', 'Send code'],
])('shows the exact recovery subtitle and inline missing-account error in %s', async (locale, subtitle, error, send) => {
  await i18n.changeLanguage(locale)
  fetchMock.mockResolvedValueOnce(response(404, accountNotFoundBody))
  await render(<ForgotPassword />)
  expect(screen.getByText(subtitle)).toBeTruthy()
  await fireEvent.changeText(screen.getByLabelText('Email'), 'absent@example.com')
  await fireEvent.press(button(send))
  expect(await within(screen.getByTestId('recovery-email-field')).findByText(error)).toBeTruthy()
  expect(screen.getAllByText(error)).toHaveLength(1)
  expect(screen.queryByText(accountNotFoundBody.message, { exact: true })).toBeNull()
  expect(mockRouter.push).not.toHaveBeenCalled()
  expect(useRecoveryFlow.getState().flow).toBeNull()
  expect(screen.queryByText(/NEVER DISPLAY/)).toBeNull()
  // A corrected email must not inherit the previous account's error.
  await fireEvent.changeText(screen.getByLabelText('Email'), 'binh@example.com')
  expect(screen.queryByText(error)).toBeNull()
  await fireEvent.press(button(send))
  await waitFor(() => expect(screen.queryByLabelText('Email')).toBeNull())
  expect(fetchMock.mock.calls[0][1].headers['idempotency-key']).not.toBe(fetchMock.mock.calls[1][1].headers['idempotency-key'])
})

it('enables send immediately after a missing-account 404 and permits retry without advancing time', async () => {
  let resolve!: (value: unknown) => void
  fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  await render(<ForgotPassword />)
  await fireEvent.changeText(screen.getByLabelText('Email'), 'absent@example.com')
  await fireEvent.press(button('Gửi mã'))
  expect(screen.getByTestId('blocking-loading-overlay')).toBeTruthy()
  expect(button('Gửi mã').props.accessibilityState.disabled).toBe(true)

  await act(async () => { resolve(response(404, accountNotFoundBody)) })
  expect(await screen.findByText('Tài khoản không tồn tại.')).toBeTruthy()
  await waitFor(() => expect(screen.queryByTestId('blocking-loading-overlay')).toBeNull())
  expect(button('Gửi mã').props.accessibilityState.disabled).toBe(false)
  expect(screen.queryByText(/Gửi lại mã sau/)).toBeNull()

  // A retry for the same email must reach the server immediately as well.
  await fireEvent.press(button('Gửi mã'))
  await waitFor(() => expect(screen.queryByLabelText('Email')).toBeNull())
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(button('Gửi lại mã sau 5:00').props.accessibilityState.disabled).toBe(true)
})

it.each([
  [200, 'UNEXPECTED_SUCCESS'],
  [204, 'UNEXPECTED_SUCCESS'],
  [404, 'NOT_FOUND'],
  [400, 'RECOVERY_ACCOUNT_NOT_FOUND'],
])('requires both the HTTP status and envelope code for the account error (%s %s)', async (status, code) => {
  fetchMock.mockResolvedValueOnce(response(status, errorBody(code)))
  await render(<ForgotPassword />)
  await fireEvent.changeText(screen.getByLabelText('Email'), 'absent@example.com')
  await fireEvent.press(button('Gửi mã'))
  expect(await screen.findByText(i18n.t('auth.genericError'))).toBeTruthy()
  expect(screen.queryByText('Tài khoản không tồn tại.')).toBeNull()
  expect(mockRouter.push).not.toHaveBeenCalled()
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
    expect(screen.queryByText('Gửi lại mã sau 60:00')).toBeNull()
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
  await waitFor(() => expect(screen.queryByLabelText('Email')).toBeNull())
  expect(fetchMock.mock.calls[0][1].headers['idempotency-key']).toBe(fetchMock.mock.calls[1][1].headers['idempotency-key'])
})

it.each(['orange', 'orangeDark'] as const)('masks email and uses role tokens and accessible OTP boxes in %s', async themeName => {
  StyleSheet.configure({ themes: { [themeName]: themes[themeName] } as unknown as typeof themes })
  seedFlow()
  await render(<ForgotPassword />)
  expect(screen.getByText(/b\*\*\*@example.com/)).toBeTruthy()
  expect(screen.queryByText(/binh@example.com/)).toBeNull()
  expect(button('Gửi lại mã sau 5:00').props.accessibilityState.disabled).toBe(true)
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
  const headings = screen.getAllByText('Quên mật khẩu')
  expect(NativeStyleSheet.flatten(headings[0].props.style)).toMatchObject({ textAlign: 'center', color: themes[themeName].accent.text })
  fetchMock.mockResolvedValueOnce(response(204))
  await fireEvent.changeText(digit(1), '123456')
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/auth/reset-password'))
  expect(useRecoveryFlow.getState().flow?.code).toBe('123456')
})

it('shows both passwords with independent visibility and the checklist at the reset step', async () => {
  seedFlow()
  await render(<ResetPassword />)
  expect(screen.queryByLabelText('Chữ số 1 trong 6 chữ số')).toBeNull()
  await fillReset()
  expect(screen.getByLabelText('Mật khẩu mới').props.secureTextEntry).toBe(true)
  await fireEvent.press(screen.getAllByRole('button', { name: 'Hiện mật khẩu' })[0])
  expect(screen.getByLabelText('Mật khẩu mới').props.secureTextEntry).toBe(false)
  expect(screen.getByLabelText('Nhập lại mật khẩu mới').props.secureTextEntry).toBe(true)
  await fireEvent.press(button('Hiện mật khẩu'))
  expect(screen.getByLabelText('Nhập lại mật khẩu mới').props.secureTextEntry).toBe(false)
  for (const rule of ['length', 'upper', 'lower', 'digit', 'special']) expect(screen.getByTestId(`password-requirement-${rule}`).props.accessibilityLabel).toMatch(/^Đã đạt:/)
})

it('places the checklist after confirmation and evaluates only the new password', async () => {
  seedFlow()
  await render(<ResetPassword />)
  const tree = JSON.stringify(screen.toJSON())
  expect(tree.indexOf('Nhập lại mật khẩu mới')).toBeLessThan(tree.indexOf('password-requirements'))
  await fireEvent.changeText(screen.getByLabelText('Mật khẩu mới'), 'GoGo2026!')
  await fireEvent.changeText(screen.getByLabelText('Nhập lại mật khẩu mới'), 'weak')
  for (const rule of ['length', 'upper', 'lower', 'digit', 'special']) {
    expect(screen.getByTestId(`password-requirement-${rule}`).props.accessibilityLabel).toMatch(/^Đã đạt:/)
  }
})

it.each(['send', 'resend', 'reset'])('blocks the full screen while %s is pending and removes the overlay on error', async kind => {
  if (kind === 'reset') seedFlow()
  if (kind === 'resend') seedFlow(Date.now() - 1)
  let resolve!: (value: unknown) => void
  fetchMock.mockImplementation(() => new Promise(done => { resolve = done }))
  await render(kind === 'reset' ? <ResetPassword /> : <ForgotPassword />)
  if (kind === 'reset') await fillReset()
  if (kind === 'send') await fireEvent.changeText(screen.getByLabelText('Email'), 'binh@example.com')
  const label = kind === 'reset' ? 'Đặt lại mật khẩu' : kind === 'send' ? 'Gửi mã' : 'Gửi lại mã'
  expect(screen.queryByTestId('blocking-loading-overlay')).toBeNull()
  await fireEvent.press(button(label))
  expect(screen.getByTestId('blocking-loading-overlay').props.accessibilityState.busy).toBe(true)
  expect(button(kind === 'resend' ? 'Gửi lại mã sau 1:00' : label).props.accessibilityState.busy).toBe(true)
  await act(async () => { resolve(response(503, errorBody('RECOVERY_UNAVAILABLE'))) })
  await waitFor(() => expect(screen.queryByTestId('blocking-loading-overlay')).toBeNull())
})

it.each(['password', 'confirmPassword', 'email', 'code'])('scrolls the focused %s and its following hints above the keyboard', async field => {
  if (field === 'password' || field === 'confirmPassword') seedFlow()
  if (field === 'code') seedFlow(Date.now() - 1)
  let keyboard: ((event: KeyboardEvent) => void) | undefined
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: KeyboardEventName, listener: (event: KeyboardEvent) => void) => {
    if (name === 'keyboardDidShow') keyboard = listener
    return { remove: jest.fn() }
  }) as unknown as typeof Keyboard.addListener)
  const move = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {})
  const groupID = field === 'email' ? 'recovery-email-field' : `auth-field-${field}`
  jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(function (this: { props: { testID?: string } }, callback) {
    if (this.props.testID === 'auth-viewport') callback(0, 100, 390, 650)
    else if (this.props.testID === groupID) callback(16, 400, 358, 240)
    else callback(16, 400, 358, 80)
  })
  await render(field === 'password' || field === 'confirmPassword' ? <ResetPassword /> : <ForgotPassword />)
  if (field === 'password' || field === 'confirmPassword') {
    expect(within(screen.getByTestId(groupID)).getByTestId('password-requirements')).toBeTruthy()
  }
  if (field === 'code') expect(within(screen.getByTestId(groupID)).getByText(i18n.t('auth.recovery.codeExpired'))).toBeTruthy()
  const input = field === 'password' ? screen.getByLabelText('Mật khẩu mới')
    : field === 'confirmPassword' ? screen.getByLabelText('Nhập lại mật khẩu mới')
    : field === 'email' ? screen.getByLabelText('Email') : digit(1)
  await fireEvent(input, 'focus', {})
  await act(async () => { keyboard?.({ endCoordinates: { screenY: 550 } } as KeyboardEvent); jest.runOnlyPendingTimers() })
  // The measured field + hints ends at 640; keyboard begins at 550, plus 8pt clearance.
  expect(move).toHaveBeenLastCalledWith(expect.objectContaining({ y: 98 }))
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
  const forgot = await render(<ForgotPassword />)
  await fireEvent.changeText(digit(1), '12')
  const newChallenge = challenge('00000000-0000-4000-8000-000000000002')
  fetchMock.mockResolvedValueOnce(response(202, newChallenge))
  await fireEvent.press(button('Gửi lại mã'))
  await waitFor(() => expect(useRecoveryFlow.getState().flow?.challengeId).toBe(newChallenge.challengeId))
  for (let i = 1; i <= 6; i++) expect(digit(i).props.value).toBe('')
  expect(button('Gửi lại mã sau 5:00').props.accessibilityState.disabled).toBe(true)
  fetchMock.mockResolvedValueOnce(response(204))
  await fireEvent.changeText(digit(1), '123456')
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/auth/reset-password'))
  await forgot.unmount()
  mockRouter.replace.mockClear()
  await render(<ResetPassword />)
  await fillReset()
  fetchMock.mockResolvedValueOnce(response(204))
  const previousSession = getSession()
  await fireEvent.press(button('Đặt lại mật khẩu'))
  expect(await screen.findByText('Đổi mật khẩu thành công')).toBeTruthy()
  expect(mockRouter.replace).not.toHaveBeenCalled()
  const [url, options] = fetchMock.mock.calls[2]
  expect(url).toMatch(/\/auth\/password-recovery\/complete$/)
  expect(JSON.parse(options.body)).toEqual({ email: 'binh@example.com', challengeId: newChallenge.challengeId, code: '123456', password: 'GoGo2026!' })
  expect(options.headers.authorization).toBeUndefined()
  expect(getSession()).toBe(previousSession)
})

it.each(['RECOVERY_MAIL_NOT_CONFIGURED', 'RECOVERY_UNAVAILABLE', 'RATE_LIMITED'])('handles completion error %s without navigating or disclosing account details', async code => {
  seedFlow()
  fetchMock.mockResolvedValue(response(code === 'RECOVERY_INVALID' ? 400 : code === 'RATE_LIMITED' ? 429 : 503, errorBody(code)))
  await render(<ResetPassword />)
  await fillReset()
  await fireEvent.press(button('Đặt lại mật khẩu'))
  await waitFor(() => expect(button('Đặt lại mật khẩu').props.accessibilityState.busy).toBe(false))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(mockRouter.replace).not.toHaveBeenCalled()
  expect(screen.queryByText(/NEVER DISPLAY/)).toBeNull()
  if (code === 'RECOVERY_INVALID') expect(screen.getByText('Mã không đúng hoặc đã hết hạn.')).toBeTruthy()
  if (code === 'RATE_LIMITED') expect(button('Đặt lại mật khẩu').props.accessibilityState.disabled).toBe(true)
})

it('does not submit weak passwords', async () => {
  seedFlow()
  await render(<ResetPassword />)
  await fireEvent.changeText(screen.getByLabelText('Mật khẩu mới'), 'weak')
  await fireEvent.press(button('Đặt lại mật khẩu'))
  expect(fetchMock).not.toHaveBeenCalled()
})

it('returns RECOVERY_INVALID to cleared OTP boxes with an error and preserves next', async () => {
  seedFlow()
  useRecoveryFlow.setState(state => ({ flow: { ...state.flow!, next: '/saved' } }))
  fetchMock.mockResolvedValueOnce(response(400, errorBody('RECOVERY_INVALID')))
  const reset = await render(<ResetPassword />)
  await fillReset()
  await fireEvent.press(button('Đặt lại mật khẩu'))
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/auth/forgot-password'))
  await reset.unmount()
  expect(useRecoveryFlow.getState().flow?.code).toBeUndefined()
  expect(useRecoveryFlow.getState().flow?.next).toBe('/saved')
  await render(<ForgotPassword />)
  expect(screen.getByText(i18n.t('auth.recovery.invalidCode'))).toBeTruthy()
  for (let n = 1; n <= 6; n++) expect(digit(n).props.value).toBe('')
  fetchMock.mockResolvedValueOnce(response(204))
  await fireEvent.changeText(digit(1), '654321')
  await waitFor(() => expect(useRecoveryFlow.getState().flow?.code).toBe('654321'))
  expect(useRecoveryFlow.getState().flow?.invalidCode).toBe(false)
})

it.each(['confirm', 'dismiss'] as const)('shows the common success sheet then resets to sign in on %s in both locales', async action => {
  seedFlow()
  useRecoveryFlow.setState(state => ({ flow: { ...state.flow!, next: '/saved' } }))
  fetchMock.mockResolvedValueOnce(response(204))
  const view = await render(<ResetPassword />)
  await fillReset()
  await fireEvent.press(button('Đặt lại mật khẩu'))
  expect(await screen.findByText('Đổi mật khẩu thành công')).toBeTruthy()
  expect(screen.getByText('Hãy đăng nhập bằng mật khẩu mới.')).toBeTruthy()
  expect(mockNavigation.reset).not.toHaveBeenCalled()
  expect(mockRouter.replace).not.toHaveBeenCalled()
  await act(async () => { await i18n.changeLanguage('en') })
  expect(screen.getByText('Password changed successfully')).toBeTruthy()
  expect(screen.getByText('Please sign in with your new password.')).toBeTruthy()
  await fireEvent.press(action === 'confirm' ? button(i18n.t('auth.signInCta')) : screen.getByLabelText(i18n.t('common.close')))
  expect(mockNavigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'auth/sign-in', params: { next: '/saved' } }] })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await view.unmount()
  expect(useRecoveryFlow.getState().flow).toBeNull()
})

it('blocks mismatches, delays inline feedback, and revalidates changes to either password', async () => {
  seedFlow()
  await render(<ResetPassword />)
  const password = screen.getByLabelText('Mật khẩu mới')
  const confirm = screen.getByLabelText('Nhập lại mật khẩu mới')
  const submit = () => button('Đặt lại mật khẩu')
  expect(submit().props.accessibilityState.disabled).toBe(true)
  await fireEvent.changeText(password, 'GoGo2026!')
  await fireEvent.changeText(confirm, 'Go')
  expect(screen.queryByText('Mật khẩu nhập lại không khớp.')).toBeNull()
  await fireEvent(confirm, 'blur')
  expect(screen.getByText('Mật khẩu nhập lại không khớp.')).toBeTruthy()
  await fireEvent.press(submit())
  await fireEvent(confirm, 'submitEditing')
  expect(fetchMock).not.toHaveBeenCalled()
  expect(submit().props.accessibilityState.disabled).toBe(true)
  await fireEvent.changeText(confirm, 'GoGo2026!')
  expect(screen.queryByText('Mật khẩu nhập lại không khớp.')).toBeNull()
  expect(submit().props.accessibilityState.disabled).toBe(false)
  await fireEvent.changeText(password, 'GoGo2027!')
  expect(submit().props.accessibilityState.disabled).toBe(true)
  expect(screen.getByText('Mật khẩu nhập lại không khớp.')).toBeTruthy()
  await fireEvent.changeText(confirm, 'GoGo2027!')
  expect(submit().props.accessibilityState.disabled).toBe(false)
  await fireEvent.changeText(password, 'weak')
  await fireEvent.changeText(confirm, 'weak')
  expect(submit().props.accessibilityState.disabled).toBe(true)
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each(['vi', 'en'])('shows a same-length mismatch before blur in %s', async locale => {
  await i18n.changeLanguage(locale)
  seedFlow()
  await render(<ResetPassword />)
  await fireEvent.changeText(screen.getByLabelText(i18n.t('auth.recovery.newPassword')), 'GoGo2026!')
  await fireEvent.changeText(screen.getByLabelText(i18n.t('auth.recovery.confirmPassword')), 'GoGo2027!')
  expect(screen.getByText(i18n.t('auth.recovery.passwordMismatch'))).toBeTruthy()
  expect(button(i18n.t('auth.recovery.resetTitle')).props.accessibilityState.disabled).toBe(true)
})

it('shows mismatch on keyboard submit before the confirmation is blurred or complete', async () => {
  seedFlow()
  await render(<ResetPassword />)
  await fireEvent.changeText(screen.getByLabelText('Mật khẩu mới'), 'GoGo2026!')
  const confirm = screen.getByLabelText('Nhập lại mật khẩu mới')
  await fireEvent.changeText(confirm, 'Go')
  expect(screen.queryByText('Mật khẩu nhập lại không khớp.')).toBeNull()
  await fireEvent(confirm, 'submitEditing')
  expect(screen.getByText('Mật khẩu nhập lại không khớp.')).toBeTruthy()
  expect(fetchMock).not.toHaveBeenCalled()
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
  await render(<ForgotPassword />)
  await fireEvent.changeText(digit(1), '12')
  await fireEvent.press(button('Gửi lại mã'))
  await waitFor(() => expect(digit(1).props.editable).toBe(true))
  expect(useRecoveryFlow.getState().flow).toBe(previous)
  expect(digit(1).props.value).toBe('1')
  expect(mockRouter.replace).not.toHaveBeenCalled()
  if (status === 429) expect(button('Gửi lại mã sau 1:00').props.accessibilityState.disabled).toBe(true)
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
  await render(<ForgotPassword />)
  expect(button('Gửi lại mã sau 5:00').props.accessibilityState.disabled).toBe(true)
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
  expect(await screen.findByText('Đổi mật khẩu thành công')).toBeTruthy()
  expect(mockRouter.replace).not.toHaveBeenCalled()
  expect(fetchMock.mock.calls[0][1].headers['idempotency-key']).toBe(fetchMock.mock.calls[1][1].headers['idempotency-key'])
  await view.unmount()
  expect(useRecoveryFlow.getState().flow).toBeNull()
})


it('counts down in the primary label, blocks resend until expiry and ignores expired OTP entry', async () => {
  seedFlow()
  await render(<ForgotPassword />)
  expect(button('Gửi lại mã sau 5:00').props.accessibilityState.disabled).toBe(true)
  await act(async () => { jest.advanceTimersByTime(1000) })
  expect(button('Gửi lại mã sau 4:59').props.accessibilityState.disabled).toBe(true)
  await act(async () => { jest.advanceTimersByTime(60_000) })
  expect(button('Gửi lại mã sau 3:59').props.accessibilityState.disabled).toBe(true)
  await act(async () => { jest.advanceTimersByTime(238_000) })
  expect(button('Gửi lại mã sau 0:01').props.accessibilityState.disabled).toBe(true)
  await act(async () => { jest.advanceTimersByTime(1000) })
  expect(button('Gửi lại mã').props.accessibilityState.disabled).toBe(false)
  await fireEvent.changeText(digit(1), '123456')
  expect(mockRouter.replace).not.toHaveBeenCalled()
  expect(fetchMock).not.toHaveBeenCalled()
  await act(async () => { await i18n.changeLanguage('en') })
  expect(button('Resend code').props.accessibilityState.disabled).toBe(false)
  expect(screen.getByText('The code has expired. Please request a new code.')).toBeTruthy()
})

it('uses the API expiry without restarting the five minutes on mount', async () => {
  seedFlow()
  await act(async () => { jest.advanceTimersByTime(42_000) })
  await render(<ForgotPassword />)
  expect(button('Gửi lại mã sau 4:18').props.accessibilityState.disabled).toBe(true)
})

it('prevents completing expired codes on the password step', async () => {
  seedFlow()
  await render(<ResetPassword />)
  await fillReset()
  await act(async () => { jest.advanceTimersByTime(300_000) })
  expect(button('Đặt lại mật khẩu').props.accessibilityState.disabled).toBe(true)
  await fireEvent.press(button('Đặt lại mật khẩu'))
  expect(fetchMock).not.toHaveBeenCalled()
  await fireEvent.press(button(i18n.t('auth.recovery.codeExpired')))
  expect(useRecoveryFlow.getState().flow?.code).toBeUndefined()
  expect(mockRouter.replace).toHaveBeenCalledWith('/auth/forgot-password')
})

it('counts the initial request and two resends per email and unlocks when the first request ages out', async () => {
  fetchMock.mockImplementation(async () => response(202, challenge()))
  const forgot = await render(<ForgotPassword />)
  await fireEvent.changeText(screen.getByLabelText('Email'), 'binh@example.com')
  await fireEvent.press(button('Gửi mã'))
  await waitFor(() => expect(screen.queryByLabelText('Email')).toBeNull())
  for (let count = 2; count <= 3; count++) {
    await act(async () => { jest.advanceTimersByTime(300_000) })
    await fireEvent.press(button('Gửi lại mã'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(count))
    await waitFor(() => expect(screen.getByText(count === 2 ? 'Gửi lại mã sau 5:00' : 'Gửi lại mã sau 50:00')).toBeTruthy())
  }
  expect(screen.getByText('Gửi lại mã sau 50:00')).toBeTruthy()
  await act(async () => { jest.advanceTimersByTime(300_000) })
  expect(button('Gửi lại mã sau 45:00').props.accessibilityState.disabled).toBe(true)
  expect(screen.getByText('Gửi lại mã sau 45:00')).toBeTruthy()
  await fireEvent.press(button('Gửi lại mã sau 45:00'))
  expect(fetchMock).toHaveBeenCalledTimes(3)
  await forgot.unmount()
  // Leaving the recovery route cannot bypass the session quota; normalized emails share it.
  await render(<ForgotPassword />)
  await fireEvent.changeText(screen.getByLabelText('Email'), 'BINH@example.com')
  expect(button('Gửi mã').props.accessibilityState.disabled).toBe(true)
  expect(screen.queryByText(/Gửi lại mã sau/)).toBeNull()
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
  await render(<ForgotPassword />)
  await fireEvent.press(button('Gửi lại mã'))
  expect(await screen.findByText(i18n.t('auth.recovery.rateLimited'))).toBeTruthy()
  expect(button(`Gửi lại mã sau ${retryAfter ? '2:00' : '1:00'}`).props.accessibilityState.disabled).toBe(true)
  const wait = retryAfter ? 120_000 : 60_000
  expect(screen.getByText(`Gửi lại mã sau ${retryAfter ? '2:00' : '1:00'}`)).toBeTruthy()
  await act(async () => { jest.advanceTimersByTime(wait - 1000) })
  expect(button('Gửi lại mã sau 0:01').props.accessibilityState.disabled).toBe(true)
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


it.each([
  ['vi', 'Mã đã gửi tới b***@example.com', 'Đổi email', 'Gửi lại mã sau 5:00'],
  ['en', 'Code sent to b***@example.com', 'Change email', 'Resend code in 5:00'],
])('shows OTP without a change-email action in %s', async (locale, context, change, countdown) => {
  mockParams = { next: '/saved' }
  await i18n.changeLanguage(locale)
  await render(<ForgotPassword />)
  await fireEvent.changeText(screen.getByLabelText('Email'), 'binh@example.com')
  await fireEvent.press(button(i18n.t('auth.recovery.sendCode')))
  expect(await screen.findByText(context)).toBeTruthy()
  expect(button(countdown).props.accessibilityState.disabled).toBe(true)
  // The countdown belongs only to the button, never a separate text row.
  expect(screen.getAllByText(countdown)).toHaveLength(1)
  expect(within(button(countdown)).getByText(countdown)).toBeTruthy()
  expect(screen.queryByText(/Mã hết hạn sau|Code expires in/)).toBeNull()
  expect(screen.queryByText(i18n.t('auth.recovery.expiry'))).toBeNull()
  expect(screen.queryByText(i18n.t('auth.recovery.backToSignIn'))).toBeNull()
  expect(screen.queryByRole('button', { name: change })).toBeNull()
  expect(screen.queryByLabelText('Email')).toBeNull()
  expect(useRecoveryFlow.getState().flow?.email).toBe('binh@example.com')
  expect(useRecoveryFlow.getState().flow?.next).toBe('/saved')
  for (let n = 1; n <= 6; n++) expect(screen.getByLabelText(i18n.t('auth.recovery.codeDigit', { position: n })).props.value).toBe('')
})

it('returns from password to OTP with header back, then clears the challenge on leaving recovery', async () => {
  seedFlow()
  const reset = await render(<ResetPassword />)
  await fireEvent.press(button(i18n.t('common.back')))
  await reset.unmount()
  expect(useRecoveryFlow.getState().flow?.code).toBeUndefined()
  const forgot = await render(<ForgotPassword />)
  expect(digit(1).props.value).toBe('')
  await forgot.unmount()
  expect(useRecoveryFlow.getState().flow).toBeNull()
})

it.each([
  ['vi', 'Nhập lại mật khẩu mới'],
  ['en', 'Re-enter new password'],
])('shows the confirmation placeholder using the password input style in %s', async (locale, placeholder) => {
  await i18n.changeLanguage(locale)
  seedFlow()
  await render(<ResetPassword />)
  const password = screen.getByLabelText(i18n.t('auth.recovery.newPassword'))
  const confirm = screen.getByLabelText(i18n.t('auth.recovery.confirmPassword'))
  expect(confirm.props.placeholder).toBe(placeholder)
  expect(confirm.props.placeholderTextColor).toBe(password.props.placeholderTextColor)
  expect(confirm.props.style).toEqual(password.props.style)
})


it('verifies all six digits anonymously, blocks pending input, and advances only on 204', async () => {
  seedFlow(Date.now() + 60_000, null)
  let resolve!: (value: unknown) => void
  fetchMock.mockImplementation(() => new Promise(done => { resolve = done }))
  await render(<ForgotPassword />)
  await fireEvent.changeText(digit(1), '12345')
  expect(fetchMock).not.toHaveBeenCalled()
  await fireEvent.changeText(digit(6), '6')
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  expect(screen.getByTestId('blocking-loading-overlay').props.accessibilityState.busy).toBe(true)
  for (let i = 1; i <= 6; i++) expect(digit(i).props.editable).toBe(false)
  expect(mockRouter.replace).not.toHaveBeenCalled()
  expect(useRecoveryFlow.getState().flow?.code).toBeUndefined()
  const [url, options] = fetchMock.mock.calls[0]
  expect(url).toMatch(/\/v1\/auth\/password-recovery\/verify$/)
  expect(options.method).toBe('POST')
  expect(JSON.parse(options.body)).toEqual({ email: 'binh@example.com', challengeId: challenge().challengeId, code: '123456' })
  expect(options.headers.authorization).toBeUndefined()
  await act(async () => { resolve(response(204)) })
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/auth/reset-password'))
  expect(useRecoveryFlow.getState().flow?.code).toBe('123456')
  expect(screen.queryByTestId('blocking-loading-overlay')).toBeNull()
})

it('keeps wrong OTP on the code screen, clears and refocuses boxes, then permits a corrected proof', async () => {
  seedFlow(Date.now() + 60_000, null)
  const focus = jest.spyOn(NativeTextInput.prototype, 'focus')
  fetchMock.mockResolvedValueOnce(response(400, errorBody('RECOVERY_INVALID'))).mockResolvedValueOnce(response(204))
  await render(<ForgotPassword />)
  focus.mockClear()
  await fireEvent.changeText(digit(1), '654321')
  expect(await within(screen.getByTestId('auth-field-code')).findByText('Mã không đúng hoặc đã hết hạn.')).toBeTruthy()
  await waitFor(() => expect(screen.queryByTestId('blocking-loading-overlay')).toBeNull())
  for (let i = 1; i <= 6; i++) expect(digit(i).props.value).toBe('')
  expect(focus).toHaveBeenCalled()
  expect((focus.mock.instances.at(-1) as unknown as NativeTextInput).props.accessibilityLabel).toBe('Chữ số 1 trong 6 chữ số')
  expect(mockRouter.replace).not.toHaveBeenCalled()
  expect(useRecoveryFlow.getState().flow?.code).toBeUndefined()
  await fireEvent.changeText(digit(1), '123456')
  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/auth/reset-password'))
  expect(screen.queryByText('Mã không đúng hoặc đã hết hạn.')).toBeNull()
})

it.each([
  [429, 'RATE_LIMITED', 'auth.recovery.rateLimited'],
  [503, 'RECOVERY_UNAVAILABLE', 'auth.recovery.unavailable'],
  [500, 'INTERNAL', 'auth.genericError'],
  [400, 'VALIDATION_FAILED', 'auth.genericError'],
  [200, 'UNEXPECTED_SUCCESS', 'auth.genericError'],
  [202, 'UNEXPECTED_SUCCESS', 'auth.genericError'],
  [0, 'OFFLINE', 'auth.networkError'],
] as const)('keeps OTP verification failure %s on OTP using existing error handling', async (status, code, key) => {
  seedFlow(Date.now() + 60_000, null)
  if (status === 0) fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'))
  else fetchMock.mockResolvedValueOnce(response(status, errorBody(code), status === 429 ? '120' : undefined))
  await render(<ForgotPassword />)
  await fireEvent.changeText(digit(1), '123456')
  expect(await screen.findByText(i18n.t(key))).toBeTruthy()
  await waitFor(() => expect(screen.queryByTestId('blocking-loading-overlay')).toBeNull())
  expect(mockRouter.replace).not.toHaveBeenCalled()
  expect(useRecoveryFlow.getState().flow?.code).toBeUndefined()
  expect(digit(1).props.editable).toBe(true)
  expect(screen.queryByText(/NEVER DISPLAY/)).toBeNull()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})
