/**
 * NTF-APP-004 (#161) — "the login actually took", as distinct from "the login
 * call returned".
 *
 * `login(externalId, jwt)` enqueues an operation and returns immediately on both
 * platforms. Treating that return as success is what let the earlier work claim
 * a binding it had not observed, and it is why an opt-in issued straight after
 * a login can land on the wrong user: the SDK may still be finishing the
 * previous account's switch.
 *
 * The SDK offers the right signal, and its own documentation says how to read
 * it — *"When using the observer to retrieve the onesignalId, check the
 * externalId as well to confirm the values are associated with the expected
 * user."* So confirmation here is two facts at once:
 *
 *   - `externalId` equals the user we just logged in as, and
 *   - `onesignalId` is **server-issued**, not the `local-` placeholder the SDK
 *     mints before the backend has answered.
 *
 * The second half is the one that carries weight. A `local-` id means the
 * device has an identity in the SDK's memory and nowhere else; under Identity
 * Verification it is exactly the state a rejected JWT leaves behind, and we
 * spent a long time reading it as success.
 *
 * ## What this does not claim
 *
 * Confirmation is still a **client-side** observation of the SDK's own state.
 * It says the SDK believes the backend assigned this id to this external id. It
 * is not a provider-side assertion — the app holds no REST credential and
 * cannot make one. Server truth is checked in verification, never at runtime.
 */

/** The SDK's placeholder before the backend assigns a real id. */
export const LOCAL_ID_PREFIX = 'local-'

export interface IdentityReader {
  getExternalId(): Promise<string | null>
  getOnesignalId(): Promise<string | null>
}

export type ConfirmationDeps = {
  reader: IdentityReader
  /** Reason codes only — never a token. */
  report?: (event: string) => void
  /**
   * How long to keep looking before giving up. Generous: this runs after a
   * network round trip, and nothing the person sees is waiting on it.
   */
  timeoutMs?: number
  pollIntervalMs?: number
}

export const CONFIRM_TIMEOUT_MS = 15_000
export const CONFIRM_POLL_MS = 250

export type ConfirmationOutcome =
  /** externalId matches and onesignalId is server-issued. */
  | { kind: 'confirmed'; onesignalId: string }
  /** The SDK moved to a different user — this login is stale, do nothing. */
  | { kind: 'superseded'; externalId: string | null }
  /** Still `local-`, or unchanged, when the bound expired. */
  | { kind: 'unconfirmed' }
  /** The SDK threw. */
  | { kind: 'unavailable' }

export function isServerIssued(onesignalId: string | null | undefined): boolean {
  return Boolean(onesignalId) && !onesignalId!.startsWith(LOCAL_ID_PREFIX)
}

export function createIdentityConfirmation(deps: ConfirmationDeps) {
  const report = deps.report ?? (() => {})
  const timeout = deps.timeoutMs ?? CONFIRM_TIMEOUT_MS
  const interval = deps.pollIntervalMs ?? CONFIRM_POLL_MS

  /**
   * Waits until the SDK agrees this device belongs to `externalId`.
   *
   * `isCurrent` is asked on every pass rather than captured once: it is what
   * stops a confirmation for account A from resolving after the app has moved
   * to B, which would otherwise hand B's subscription an opt-in decided for A.
   */
  return async function confirm(
    externalId: string,
    isCurrent: () => boolean,
  ): Promise<ConfirmationOutcome> {
    const deadline = Date.now() + timeout

    for (;;) {
      if (!isCurrent()) {
        report('push_identity_confirm_superseded')
        return { kind: 'superseded', externalId: null }
      }

      let seenExternal: string | null
      let seenOnesignal: string | null
      try {
        // Read together, external id first: if the pair disagrees we would
        // rather see the newer external id and treat it as superseded than
        // pair a stale external id with a fresh onesignal id.
        seenExternal = await deps.reader.getExternalId()
        seenOnesignal = await deps.reader.getOnesignalId()
      } catch {
        report('push_identity_confirm_unavailable')
        return { kind: 'unavailable' }
      }

      if (seenExternal && seenExternal !== externalId) {
        // Someone else owns the SDK now. Not our login to confirm.
        report('push_identity_confirm_superseded')
        return { kind: 'superseded', externalId: seenExternal }
      }

      if (seenExternal === externalId && isServerIssued(seenOnesignal)) {
        report('push_identity_confirmed')
        return { kind: 'confirmed', onesignalId: seenOnesignal! }
      }

      if (Date.now() >= deadline) {
        // Either still `local-`, or the external id never appeared. Under
        // Identity Verification a refused JWT looks exactly like this, so it is
        // reported rather than waited out forever.
        report('push_identity_unconfirmed')
        return { kind: 'unconfirmed' }
      }

      await new Promise((resolve) => setTimeout(resolve, interval))
    }
  }
}
