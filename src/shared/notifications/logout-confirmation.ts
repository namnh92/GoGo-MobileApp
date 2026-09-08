/**
 * NTF-APP-004 (#160) — unsubscribing this device, and *knowing* it happened,
 * before sign-out is allowed to clear the session.
 *
 * `OneSignal.logout()` returns `void` on both SDKs: it enqueues. Awaiting the
 * bridge therefore proves only that the operation was queued locally, which is
 * why sign-out used to report success while the provider still had the device
 * subscribed. The device cannot settle this on its own either — under Identity
 * Verification, logout sets a disabled flag the device-side opt-in API does not
 * report, so an unsent logout looks exactly like a delivered one.
 *
 * So the answer comes from the backend, which reads it from the provider. That
 * read needs the session, which is precisely why this runs *before* anything is
 * cleared: doing it afterwards destroys the credential the check depends on.
 *
 * Failure is failure. There is no offline path and no deferred cleanup here on
 * purpose: a device that cannot confirm stays signed in, and the caller says so.
 */

/** Generous: this is a network round trip plus the SDK flushing its queue. */
export const CONFIRM_UNSUBSCRIBE_TIMEOUT_MS = 15_000
export const CONFIRM_UNSUBSCRIBE_POLL_MS = 500

export class UnsubscribeNotConfirmedError extends Error {
  constructor(readonly reason: 'still_enabled' | 'unavailable') {
    super(`push unsubscribe not confirmed: ${reason}`)
    this.name = 'UnsubscribeNotConfirmedError'
  }
}

export type LogoutConfirmationDeps = {
  /** Ends the provider session for this device. Enqueues; does not confirm. */
  unsubscribe: () => Promise<void>
  /** This device's provider subscription id, or null when it has none. */
  getSubscriptionId: () => Promise<string | null>
  /** Asks the backend whether the provider still has it enabled for us. */
  confirm: (subscriptionId: string) => Promise<boolean>
  /** Reason codes only. Never a token, never a user id. */
  report?: (event: string) => void
  timeoutMs?: number
  pollIntervalMs?: number
  sleep?: (ms: number) => Promise<void>
}

export function createLogoutConfirmation(deps: LogoutConfirmationDeps) {
  const report = deps.report ?? (() => {})
  const timeout = deps.timeoutMs ?? CONFIRM_UNSUBSCRIBE_TIMEOUT_MS
  const interval = deps.pollIntervalMs ?? CONFIRM_UNSUBSCRIBE_POLL_MS
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))

  /**
   * Resolves only when the provider agrees this device is no longer live for
   * the signed-in user. Throws otherwise — the caller must not clear anything.
   */
  return async function unsubscribeAndConfirm(): Promise<void> {
    // Read the id *before* logging out, deliberately. Afterwards the SDK holds
    // an anonymous user, and if it minted a fresh subscription for that user we
    // would go on to ask about an id the signed-in user never had — the backend
    // would truthfully answer "not subscribed here" and we would clear the
    // session on a device still receiving their notifications. The id that
    // matters is the one bound to the account at the moment it signs out.
    const subscriptionId = await deps.getSubscriptionId()

    await deps.unsubscribe()

    if (!subscriptionId) {
      // No subscription on this device, so nothing of theirs can be delivered
      // to it. Distinct reason code: it is a different fact from a confirmed
      // teardown, and reading it as one later would be a mistake.
      report('push_logout_no_subscription')
      return
    }

    const deadline = Date.now() + timeout
    for (;;) {
      let confirmed: boolean
      try {
        confirmed = await deps.confirm(subscriptionId)
      } catch {
        // Includes the backend refusing to guess when the provider is
        // unreachable. Never treated as success.
        report('push_logout_confirm_unavailable')
        throw new UnsubscribeNotConfirmedError('unavailable')
      }
      if (confirmed) {
        report('push_logout_confirmed')
        return
      }
      if (Date.now() >= deadline) {
        report('push_logout_still_subscribed')
        throw new UnsubscribeNotConfirmedError('still_enabled')
      }
      await sleep(interval)
    }
  }
}
