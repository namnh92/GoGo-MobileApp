jest.mock('@/shared/api/queries/use-my-place-submissions', () => ({ useMyPlaceSubmissions: () => ({ data: { pages: [{ items: [], nextCursor: null }] } }) }))
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { AccessibilityInfo, Keyboard } from 'react-native'
import { StyleSheet } from 'react-native-unistyles'
import { themes } from '@/shared/ui/theme'

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
const mockActor: { session: { kind: 'user'; userId: string } | null } = { session: { kind: 'user', userId: 'u' } }
jest.mock('@/shared/providers/session-provider', () => ({
  useSession: () => ({
    session: mockActor.session,
    status: mockActor.session ? 'user' : 'anonymous',
    signOut: mockSignOut,
  }),
}))
jest.mock('@/shared/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}))
const mockSessionLeft: { present: boolean } = { present: true }
jest.mock('@/shared/api/session', () => ({
  ...jest.requireActual('@/shared/api/session'),
  getSession: () => (mockSessionLeft.present ? { kind: 'user', accessToken: 't', expiresAt: 0, userId: 'u' } : null),
}))
jest.mock('@/shared/api', () => {
  const idle = { data: undefined, isPending: false, isError: false, error: null, refetch: jest.fn() }
  return {
    useTaxonomies: () => ({ data: { kinds: {} } }),
    useMyRooms: () => ({ data: { pages: [] }, hasNextPage: false }),
    useMe: () => idle,
    useSaved: () => idle,
    useMyReviews: () => idle,
    useNotificationSettings: () => idle,
  }
})

import ProfileScreen from '@/features/tabs/profile.view'

const pushUnavailable = new UnsubscribeNotConfirmedError(
  'unavailable',
  new ApiError(503, { code: 'PUSH_IDENTITY_UNAVAILABLE', message: 'x', retryable: false }),
)

beforeEach(() => {
  mockActor.session = { kind: 'user', userId: 'u' }
  mockSessionLeft.present = true
  mockSignOut.mockReset()
  mockReplace.mockReset()
  mockTrack.mockReset()
})

async function tapSignOut() {
  await act(async () => {
    await fireEvent.press(screen.getByText(viMessages['g11.logout'] as string))
  })
  await fireEvent.press(screen.getByText('Xác nhận'))
  await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1))
}

describe.each(['orange', 'orangeDark'] as const)('%s blocking sign-out', name => {
  afterEach(() => { jest.restoreAllMocks(); StyleSheet.configure({ themes }) })
  it.each(['success', 'failure'] as const)('keeps the overlay until %s and releases it before showing an error', async outcome => {
    StyleSheet.configure({ themes: { [name]: themes[name] } as unknown as typeof themes })
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
    const dismiss = jest.spyOn(Keyboard, 'dismiss')
    let finish!: () => void
    let fail!: (error: Error) => void
    mockSignOut.mockImplementation(() => new Promise<void>((resolve, reject) => { finish = resolve; fail = reject }))
    await render(<ProfileScreen />)
    await tapSignOut()
    expect(screen.getByTestId('blocking-loading-overlay').props.accessibilityState.busy).toBe(true)
    expect(screen.queryByTestId('profile-logout-confirm')).toBeNull()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(dismiss).toHaveBeenCalled()
    await fireEvent(screen.getByTestId('blocking-loading-modal'), 'requestClose')
    expect(screen.getByTestId('blocking-loading-overlay')).toBeTruthy()
    await act(async () => { if (outcome === 'success') finish(); else fail(new NetworkError()) })
    expect(screen.queryByTestId('blocking-loading-overlay')).toBeNull()
    if (outcome === 'success') expect(mockReplace).toHaveBeenCalledWith('/(tabs)')
    else {
      expect(screen.getByTestId('result-sheet')).toBeTruthy()
      expect(screen.getByText(viMessages['profile.logoutFailedOffline'] as string)).toBeTruthy()
      expect(mockReplace).not.toHaveBeenCalled()
    }
  })
})

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

it('a credential that was already dead says the session ended and leaves like a sign-out (F-02)', async () => {
  // The refresh answered 401 and the client ended the session locally; the
  // push check then failed unauthenticated. "You are still signed in" is false.
  mockSessionLeft.present = false
  mockSignOut.mockImplementationOnce(async () => {
    // The refresh's 401 ended the session locally before the call failed.
    mockActor.session = null
    throw new UnsubscribeNotConfirmedError('unavailable', new ApiError(401, { code: 'UNAUTHORIZED', message: 'x' }))
  })
  await render(<ProfileScreen />)

  await tapSignOut()

  expect(screen.getByText(viMessages['profile.logoutSessionEnded'] as string)).toBeTruthy()
  expect(screen.queryByText(viMessages['profile.logoutFailedPush'] as string)).toBeNull()
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)')
  expect(mockTrack).toHaveBeenCalledWith('auth_sign_out_failed', { reason: 'session_ended' })
})

it('does not keep the ended-session line once someone signs in again (F-03)', async () => {
  // The Profile tab stays mounted: sign-out lands on another tab and sign-in
  // comes back to this same instance.
  mockSessionLeft.present = false
  mockSignOut.mockImplementationOnce(async () => {
    mockActor.session = null
    throw new UnsubscribeNotConfirmedError('unavailable', new ApiError(401, { code: 'UNAUTHORIZED', message: 'x' }))
  })
  const view = await render(<ProfileScreen />)
  await tapSignOut()
  expect(screen.getByText(viMessages['profile.logoutSessionEnded'] as string)).toBeTruthy()

  mockActor.session = { kind: 'user', userId: 'someone-else' }
  mockSessionLeft.present = true
  await act(async () => {
    await view.rerender(<ProfileScreen />)
  })

  expect(screen.queryByText(viMessages['profile.logoutSessionEnded'] as string)).toBeNull()
})
