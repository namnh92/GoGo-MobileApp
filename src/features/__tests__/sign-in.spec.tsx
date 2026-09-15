import { act, fireEvent, waitFor } from '@testing-library/react-native'

import { ApiError, TimeoutError } from '@/shared/api'

import { renderScreen } from './harness'

/**
 * #252 — sign-in and sign-up are two react-hook-form instances drawn through
 * one pair of email/password fields. Kept mounted across the tab switch, those
 * fields stayed subscribed to sign-in's form state: sign-up's errors were never
 * drawn, and an invalid sign-up did nothing at all — no request, no message.
 *
 * The session provider is replaced (it drags in the OneSignal native module),
 * but its signIn/signUp call the real session endpoints over a faked `fetch`,
 * so request counts and the client's own error types are the shipped ones.
 */

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element)
  })
}

async function type(element: Parameters<typeof fireEvent.changeText>[0], value: string) {
  await act(async () => {
    fireEvent.changeText(element, value)
  })
}

const mockReplace = jest.fn()
const mockTrack = jest.fn()
const mockSignIn = jest.fn()
const mockSignUp = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn(), push: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({}),
}))

jest.mock('@/shared/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}))

jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ signIn: mockSignIn, signUp: mockSignUp }),
}))

import SignInScreen from '@/features/auth/sign-in.view'
import { classifyAuthFailure } from '@/features/auth/auth-failure'

const COPY = {
  emailInvalid: 'Email chưa đúng định dạng.',
  passwordInvalid: 'Mật khẩu cần ít nhất 10 ký tự.',
  displayNameInvalid: 'Nhập tên từ 1 đến 50 ký tự.',
  network: 'Mất kết nối. Kiểm tra mạng rồi thử lại.',
  timeout: 'Máy chủ phản hồi quá lâu. Kiểm tra mạng rồi thử lại.',
  unexpected: 'Ứng dụng gặp lỗi ngoài dự kiến. Thử lại nhé, nếu vẫn lỗi hãy mở lại ứng dụng.',
  invalidCredentials: 'Email hoặc mật khẩu không đúng.',
}

const GRANT = {
  userId: '11111111-1111-4111-8111-111111111111',
  accessToken: 'test-access',
  refreshToken: 'test-refresh',
  expiresIn: 900,
}

const fetchMock = jest.fn()
const realFetch = global.fetch

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

const callsTo = (suffix: string) => fetchMock.mock.calls.filter(([url]) => String(url).endsWith(suffix))

beforeEach(() => {
  jest.clearAllMocks()
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(jsonResponse(201, GRANT))
  global.fetch = fetchMock as unknown as typeof fetch
  const sessions = jest.requireActual<typeof import('@/shared/api/endpoints/sessions')>('@/shared/api/endpoints/sessions')
  mockSignIn.mockImplementation(body => sessions.login(body))
  mockSignUp.mockImplementation(body => sessions.register(body))
})

afterAll(() => {
  global.fetch = realFetch
})

async function openSignUp() {
  const view = await renderScreen(<SignInScreen />)
  await press(view.getByRole('tab', { name: 'Đăng ký' }))
  return view
}

describe('sign-up validation (#252)', () => {
  it('shows the password rule for a short password and sends no register request', async () => {
    const view = await openSignUp()
    await type(view.getByLabelText('Tên hiển thị'), 'An')
    await type(view.getByLabelText('Email'), 'an@example.com')
    await type(view.getByLabelText('Mật khẩu'), 'short12')

    await press(view.getByRole('button', { name: 'Tạo tài khoản' }))

    expect(await view.findByText(COPY.passwordInvalid)).toBeTruthy()
    expect(view.queryByText(COPY.emailInvalid)).toBeNull()
    expect(callsTo('/auth/register')).toHaveLength(0)
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('shows every field its own error when an empty sign-up is submitted', async () => {
    const view = await openSignUp()

    await press(view.getByRole('button', { name: 'Tạo tài khoản' }))

    expect(await view.findByText(COPY.displayNameInvalid)).toBeTruthy()
    expect(view.getByText(COPY.emailInvalid)).toBeTruthy()
    expect(view.getByText(COPY.passwordInvalid)).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps each form its own errors and values across sign-in → sign-up → sign-in', async () => {
    const view = await renderScreen(<SignInScreen />)

    // Sign-in: a malformed email, a password present.
    await type(view.getByLabelText('Email'), 'not-an-email')
    await type(view.getByLabelText('Mật khẩu'), 'x')
    await press(view.getByRole('button', { name: 'Đăng nhập' }))
    expect(await view.findByText(COPY.emailInvalid)).toBeTruthy()
    expect(view.queryByText(COPY.passwordInvalid)).toBeNull()

    // Sign-up has not been submitted: sign-in's error must not follow it here.
    await press(view.getByRole('tab', { name: 'Đăng ký' }))
    expect(view.queryByText(COPY.emailInvalid)).toBeNull()
    expect(view.getByLabelText('Email').props.value).toBe('')

    await type(view.getByLabelText('Tên hiển thị'), 'An')
    await type(view.getByLabelText('Email'), 'an@example.com')
    await type(view.getByLabelText('Mật khẩu'), 'short')
    await press(view.getByRole('button', { name: 'Tạo tài khoản' }))
    expect(await view.findByText(COPY.passwordInvalid)).toBeTruthy()
    expect(view.queryByText(COPY.emailInvalid)).toBeNull()

    // Back on sign-in: its own error and its own typed email, not sign-up's.
    await press(view.getByRole('tab', { name: 'Đăng nhập' }))
    expect(view.getByText(COPY.emailInvalid)).toBeTruthy()
    expect(view.queryByText(COPY.passwordInvalid)).toBeNull()
    expect(view.queryByLabelText('Tên hiển thị')).toBeNull()
    expect(view.getByLabelText('Email').props.value).toBe('not-an-email')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends exactly one register request for a valid sign-up', async () => {
    const view = await openSignUp()
    await type(view.getByLabelText('Tên hiển thị'), 'An')
    await type(view.getByLabelText('Email'), 'an@example.com')
    await type(view.getByLabelText('Mật khẩu'), 'long-enough-1')

    await press(view.getByRole('button', { name: 'Tạo tài khoản' }))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)'))
    const register = callsTo('/auth/register')
    expect(register).toHaveLength(1)
    expect(JSON.parse(register[0][1].body)).toEqual({
      displayName: 'An',
      email: 'an@example.com',
      password: 'long-enough-1',
    })
    expect(mockTrack).toHaveBeenCalledWith('auth_registered')
  })

  // The iPhone retest saw a 5-character password answered with 201: iOS had
  // replaced it with a suggested strong password. Validation runs on whatever
  // value the field holds at submit, including a value autofill swapped in.
  it('validates the password autofill put in the field, not the one typed first', async () => {
    const view = await openSignUp()
    await type(view.getByLabelText('Tên hiển thị'), 'An')
    await type(view.getByLabelText('Email'), 'an@example.com')
    await type(view.getByLabelText('Mật khẩu'), 'abc12')
    await type(view.getByLabelText('Mật khẩu'), 'Xk3v-autofill-strong-9Q')

    await press(view.getByRole('button', { name: 'Tạo tài khoản' }))

    await waitFor(() => expect(callsTo('/auth/register')).toHaveLength(1))
    expect(JSON.parse(callsTo('/auth/register')[0][1].body).password).toBe('Xk3v-autofill-strong-9Q')
  })

  it('rejects a short password that replaced an autofilled one', async () => {
    const view = await openSignUp()
    await type(view.getByLabelText('Tên hiển thị'), 'An')
    await type(view.getByLabelText('Email'), 'an@example.com')
    await type(view.getByLabelText('Mật khẩu'), 'Xk3v-autofill-strong-9Q')
    await type(view.getByLabelText('Mật khẩu'), 'abc12')

    await press(view.getByRole('button', { name: 'Tạo tài khoản' }))

    expect(await view.findByText(COPY.passwordInvalid)).toBeTruthy()
    expect(callsTo('/auth/register')).toHaveLength(0)
  })
})

describe('sign-in failure classification (#252)', () => {
  async function submitValidSignIn() {
    const view = await renderScreen(<SignInScreen />)
    await type(view.getByLabelText('Email'), 'an@example.com')
    await type(view.getByLabelText('Mật khẩu'), 'secret-password')
    await press(view.getByRole('button', { name: 'Đăng nhập' }))
    return view
  }

  it('shows the network copy when the request cannot leave the device', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))

    const view = await submitValidSignIn()

    expect(await view.findByText(COPY.network)).toBeTruthy()
    expect(callsTo('/auth/login')).toHaveLength(1)
    expect(mockTrack).toHaveBeenCalledWith('auth_sign_in_failed', { reason: 'offline' })
  })

  it('shows the timeout copy when the request budget runs out', async () => {
    mockSignIn.mockRejectedValue(new TimeoutError(15_000))

    const view = await submitValidSignIn()

    expect(await view.findByText(COPY.timeout)).toBeTruthy()
    expect(view.queryByText(COPY.network)).toBeNull()
    expect(mockTrack).toHaveBeenCalledWith('auth_sign_in_failed', { reason: 'timeout' })
  })

  it('shows its own copy for an unexpected error and records a PII-free reason', async () => {
    mockSignIn.mockRejectedValue(new Error('secure store failed for an@example.com / secret-password'))

    const view = await submitValidSignIn()

    expect(await view.findByText(COPY.unexpected)).toBeTruthy()
    expect(view.queryByText(COPY.network)).toBeNull()
    expect(mockTrack).toHaveBeenCalledWith('auth_sign_in_failed', { reason: 'unexpected', errorName: 'Error' })
    const recorded = JSON.stringify(mockTrack.mock.calls)
    expect(recorded).not.toContain('an@example.com')
    expect(recorded).not.toContain('secret-password')
  })

  it('still says invalid credentials for a 401, with status and code only', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password', field_errors: [], retryable: false }),
    )

    const view = await submitValidSignIn()

    expect(await view.findByText(COPY.invalidCredentials)).toBeTruthy()
    expect(mockTrack).toHaveBeenCalledWith('auth_sign_in_failed', {
      reason: 'invalid_credentials',
      status: 401,
      code: 'INVALID_CREDENTIALS',
    })
  })
})

describe('classifyAuthFailure', () => {
  const api = (status: number, extra: Record<string, unknown> = {}) =>
    new ApiError(status, { code: `HTTP_${status}`, message: 'm', ...extra })

  it('maps API statuses to the existing copy and reason codes', () => {
    expect(classifyAuthFailure(api(409))).toMatchObject({ reason: 'conflict', messageKey: 'auth.registerConflict' })
    expect(classifyAuthFailure(api(429))).toMatchObject({ reason: 'rate_limited', messageKey: 'auth.rateLimited' })
    expect(classifyAuthFailure(api(503))).toMatchObject({ reason: 'server', messageKey: 'auth.genericError' })
    expect(classifyAuthFailure(api(400))).toMatchObject({ reason: 'rejected', messageKey: 'auth.genericError' })
    expect(
      classifyAuthFailure(api(400, { field_errors: [{ field: 'email', message: 'Email đã được dùng' }] })),
    ).toMatchObject({ reason: 'field_invalid', serverMessage: 'Email đã được dùng' })
  })

  it('never lets an arbitrary error name into telemetry', () => {
    const odd = new Error('x')
    odd.name = 'user an@example.com'
    expect(classifyAuthFailure(odd).telemetry).toEqual({ reason: 'unexpected', errorName: 'unknown' })
    expect(classifyAuthFailure('boom').telemetry).toEqual({ reason: 'unexpected', errorName: 'string' })
  })
})
