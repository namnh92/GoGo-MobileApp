import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/shared/api/client'
import { logout } from '@/shared/api/endpoints/sessions'
import { ApiError, NetworkError, TimeoutError } from '@/shared/api/errors'
import { clearSession, getSession, persistSession, type Session } from '@/shared/api/session'
import {
  createLogoutConfirmation,
  UnsubscribeNotConfirmedError,
} from '@/shared/notifications/logout-confirmation'
import { signOutFailureReason } from '../sign-out-failure'

/**
 * GoGo-MobileApp#279. Sign-out stays fail-closed; what is under test is that
 * the reason it was refused survives to the screen. Every case below used to
 * read as "check your connection".
 */

const pushUnavailable = new ApiError(503, {
  code: 'PUSH_IDENTITY_UNAVAILABLE',
  message: 'Push identity signing is not configured in this environment',
  retryable: false,
})

/** Runs the real confirmation with a backend that throws `error`. */
async function confirmThrowing(error: unknown): Promise<unknown> {
  const run = createLogoutConfirmation({
    unsubscribe: async () => {},
    getSubscriptionId: async () => 'b3e26d4e-59dd-4eda-bd34-8261885ccefc',
    confirm: async () => {
      throw error
    },
    sleep: async () => {},
  })
  return run().then(
    () => {
      throw new Error('sign-out must not proceed')
    },
    (rejection: unknown) => rejection,
  )
}

describe('why a sign-out was refused (#279)', () => {
  it('a push service that answered "unavailable" is not a connection problem', async () => {
    // The reported case: 503 PUSH_IDENTITY_UNAVAILABLE in 5 ms, network fine.
    const rejection = await confirmThrowing(pushUnavailable)
    expect(rejection).toBeInstanceOf(UnsubscribeNotConfirmedError)
    expect(signOutFailureReason(rejection)).toBe('push_unconfirmed')
  })

  it('a provider that still has the device enabled is a push failure too', () => {
    expect(signOutFailureReason(new UnsubscribeNotConfirmedError('still_enabled'))).toBe('push_unconfirmed')
  })

  it('the push check failing because the device is offline says offline', async () => {
    const rejection = await confirmThrowing(new NetworkError())
    expect(signOutFailureReason(rejection)).toBe('offline')
  })

  it('the push check timing out says timeout', async () => {
    const rejection = await confirmThrowing(new TimeoutError(15_000))
    expect(signOutFailureReason(rejection)).toBe('timeout')
  })

  it('the session revoke failing offline or slowly says so', () => {
    expect(signOutFailureReason(new NetworkError())).toBe('offline')
    expect(signOutFailureReason(new TimeoutError(15_000))).toBe('timeout')
  })

  it('anything else is not blamed on the connection', () => {
    expect(signOutFailureReason(new ApiError(500, { code: 'INTERNAL', message: 'x' }))).toBe('other')
    expect(signOutFailureReason(new Error('bridge gone'))).toBe('other')
  })
})

/**
 * Review findings on PR #312. Both run the real client: an expired access
 * token sends sign-out through the token refresh before either step.
 */
describe('sign-out with an expired access token (#279 F-01, F-02)', () => {
  const expired: Session = {
    kind: 'user',
    accessToken: 'expired-access',
    refreshToken: 'refresh-1',
    expiresAt: Date.now() - 1_000,
    userId: 'user-1',
  }
  const realConfirm = createLogoutConfirmation({
    unsubscribe: async () => {},
    getSubscriptionId: async () => 'b3e26d4e-59dd-4eda-bd34-8261885ccefc',
    confirm: async (subscriptionId) =>
      (await api.post<{ confirmed: boolean }>('/notifications/identity/logout', { subscriptionId })).confirmed,
    sleep: async () => {},
  })
  const failure = (run: () => Promise<unknown>) =>
    run().then(
      () => {
        throw new Error('sign-out must not proceed')
      },
      (rejection: unknown) => signOutFailureReason(rejection, getSession() !== null),
    )

  beforeEach(async () => {
    await persistSession(expired)
  })
  afterEach(async () => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    await clearSession()
  })

  it('offline at the push check says offline, not push', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'))
    expect(await failure(() => realConfirm())).toBe('offline')
  })

  it('offline at the session revoke says offline, not other', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'))
    expect(await failure(() => logout())).toBe('offline')
  })

  it('a refresh that never answers times out instead of hanging', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
    )
    const outcome = failure(() => logout())
    await vi.advanceTimersByTimeAsync(15_000)
    expect(await outcome).toBe('timeout')
  })

  it('a dead refresh token reads as an ended session, not "still signed in"', async () => {
    // Refresh answers 401: the client ends the session locally, and the call
    // that needed it then fails unauthenticated.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ code: 'INVALID_TOKEN', message: 'revoked' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    )
    expect(await failure(() => realConfirm())).toBe('session_ended')
    await persistSession(expired)
    expect(await failure(() => logout())).toBe('session_ended')
  })
})
