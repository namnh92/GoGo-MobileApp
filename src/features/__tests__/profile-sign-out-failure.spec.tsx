import { act, fireEvent, render, screen } from '@testing-library/react-native'

import '@/shared/i18n'
import { ApiError, NetworkError, TimeoutError } from '@/shared/api/errors'
import { viMessages } from '@/shared/i18n/vi'
import { UnsubscribeNotConfirmedError } from '@/shared/notifications/logout-confirmation'

/**
 * GoGo-MobileApp#279 — a refused sign-out says why. Fail-closed is unchanged:
 * the person stays signed in and stays on this screen in every case.
 */

const mockSignOut = jest.fn()
const mockReplace = jest.fn()
const mockTrack = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
}))
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({ status: 'user', signOut: mockSignOut }),
}))
jest.mock('@/shared/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}))
jest.mock('@/shared/api', () => {
  const idle = { data: undefined, isPending: false, isError: false, error: null, refetch: jest.fn() }
  return {
    useMe: () => idle,
    useSaved: () => idle,
    useMyReviews: () => idle,
    useNotificationSettings: () => idle,
  }
})

// eslint-disable-next-line import/first
import ProfileScreen from '@/features/tabs/profile.view'

const pushUnavailable = new UnsubscribeNotConfirmedError(
  'unavailable',
  new ApiError(503, { code: 'PUSH_IDENTITY_UNAVAILABLE', message: 'x', retryable: false }),
)

beforeEach(() => {
  mockSignOut.mockReset()
  mockReplace.mockReset()
  mockTrack.mockReset()
})

async function tapSignOut() {
  await act(async () => {
    fireEvent.press(screen.getByText(viMessages['profile.logout'] as string))
  })
}

it.each([
  ['push_unconfirmed', pushUnavailable, 'profile.logoutFailedPush'],
  ['push_unconfirmed', new UnsubscribeNotConfirmedError('still_enabled'), 'profile.logoutFailedPush'],
  ['offline', new UnsubscribeNotConfirmedError('unavailable', new NetworkError()), 'profile.logoutFailedOffline'],
  ['offline', new NetworkError(), 'profile.logoutFailedOffline'],
  ['timeout', new TimeoutError(15_000), 'profile.logoutFailedTimeout'],
  ['other', new ApiError(500, { code: 'INTERNAL', message: 'x' }), 'profile.logoutFailed'],
] as const)('a %s refusal shows its own message and keeps the person signed in', async (reason, error, key) => {
  mockSignOut.mockRejectedValueOnce(error)
  await render(<ProfileScreen />)

  await tapSignOut()

  expect(screen.getByText(viMessages[key] as string)).toBeTruthy()
  expect(mockReplace).not.toHaveBeenCalled()
  expect(mockTrack).toHaveBeenCalledWith('auth_sign_out_failed', { reason })
})

it('only blames the connection when the device really could not reach the server', async () => {
  mockSignOut.mockRejectedValueOnce(pushUnavailable)
  await render(<ProfileScreen />)

  await tapSignOut()

  // The reported defect: a push service answering in 5 ms read as "check your
  // connection", and retrying with a healthy network changed nothing.
  expect(screen.queryByText(/Kiểm tra kết nối/)).toBeNull()
})
