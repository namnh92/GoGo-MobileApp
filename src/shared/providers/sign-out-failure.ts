import { NetworkError, TimeoutError } from '@/shared/api/errors'
import { UnsubscribeNotConfirmedError } from '@/shared/notifications/logout-confirmation'

/**
 * Why a sign-out did not happen (#279).
 *
 * Sign-out stays fail-closed (NTF-APP-004, #160): any step failing leaves the
 * person signed in. What changes here is only what they are told. Every
 * failure used to say "check your connection", including a push service that
 * answered in 5 ms — sending people to fix a network that was fine, and
 * leaving support unable to tell the causes apart.
 *
 *   - `offline`          — the request never reached the server;
 *   - `timeout`          — it went out and no answer came back in time;
 *   - `push_unconfirmed` — the server answered, but could not confirm this
 *                          device stopped receiving the account's
 *                          notifications (the provider was down, refused, or
 *                          still had it enabled);
 *   - `session_ended`    — the session was already gone when the attempt
 *                          failed: a refresh answered 401 and the client
 *                          ended it locally (and purged). Telling that person
 *                          "you are still signed in" would be false (F-02);
 *   - `other`            — anything else, e.g. the session revoke itself failed.
 *
 * Reason codes only: safe for telemetry, never a message or an id.
 */
export type SignOutFailure = 'offline' | 'timeout' | 'push_unconfirmed' | 'session_ended' | 'other'

/**
 * `sessionPresent` is read *after* the failure. Whatever step failed, a device
 * with no session left is signed out — the dead credential ended it.
 */
export function signOutFailureReason(error: unknown, sessionPresent = true): SignOutFailure {
  if (!sessionPresent) return 'session_ended'
  // The push check wraps whatever its call threw. A device that could not
  // reach the backend at all is offline, whichever step it happened in.
  const underlying =
    error instanceof UnsubscribeNotConfirmedError && error.cause !== undefined ? error.cause : error
  if (underlying instanceof TimeoutError) return 'timeout'
  if (underlying instanceof NetworkError) return 'offline'
  if (error instanceof UnsubscribeNotConfirmedError) return 'push_unconfirmed'
  return 'other'
}
