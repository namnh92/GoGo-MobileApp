import { describe, expect, it } from 'vitest'

import { ApiError, NetworkError, TimeoutError } from '@/shared/api/errors'
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
