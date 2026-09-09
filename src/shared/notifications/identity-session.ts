/**
 * NTF-APP-004 (#51) — bind the push subscription to the signed-in user, and
 * prove it.
 *
 * Pure and injectable: the native module, the token fetch and the logger all
 * arrive as arguments, so every branch below is testable without a device.
 * `bootstrap.ts` is the only place that supplies the real ones.
 *
 * Three rules the shape encodes:
 *
 *   - a `user` session logs in, anything else logs out. A guest session is
 *     room-scoped and is not a person; binding a subscription to one would
 *     attach a device to a session id;
 *   - the same user id is never logged in twice. Re-running is a no-op, so a
 *     session refresh — which changes the access token and not the person —
 *     does not churn the provider;
 *   - identity is verified or it does not happen. When the environment holds
 *     no signing key the endpoint answers 503, and the default is to leave the
 *     device unbound rather than fall back to an unverified login. Falling back
 *     is possible but has to be asked for by name.
 */

export type IdentityToken = { externalId: string; token: string; expiresAt: string }

export interface OneSignalIdentity {
  loginWithToken(externalId: string, token: string): Promise<void>
  loginWithoutToken(externalId: string): Promise<void>
  logout(): Promise<void>
  respondToJwtExpired(externalId: string, token: string): Promise<void>
  onJwtExpired(handler: (externalId: string) => void): { remove(): void }
}

export type IdentityFetchOutcome =
  | { kind: 'ok'; token: IdentityToken }
  /** 503 PUSH_IDENTITY_UNAVAILABLE — no signing key in this environment. */
  | { kind: 'unavailable' }
  /** 401/403, or a network failure. Worth retrying on the next session change. */
  | { kind: 'error' }

/**
 * Whether this device may hold a push subscription right now. Supplied by the
 * caller and **defaults to refusing**: a slice that has not wired permission
 * and preference must not opt anyone in, and failing closed is the only safe
 * default for a decision about someone's notifications.
 */
export type OptInEligibility = () => Promise<boolean>

export type ConfirmIdentity = (
  externalId: string,
  isCurrent: () => boolean,
) => Promise<{ kind: string }>

export type IdentitySessionDeps = {
  native: OneSignalIdentity
  fetchToken: () => Promise<IdentityFetchOutcome>
  /**
   * Waits until the SDK agrees the device belongs to this user. Optional so
   * existing callers keep their behaviour; without it nothing is opted in,
   * which is the same fail-closed default as `eligible`.
   */
  confirmIdentity?: ConfirmIdentity
  /** Called only after identity is confirmed, and only if this answers true. */
  eligible?: OptInEligibility
  /** Opting this device back in. Never called without confirmation. */
  optIn?: () => void
  /**
   * NTF-APP-008 (#171) — tells the API this device holds a live push
   * subscription for this user, once that is actually true.
   *
   * Optional and best-effort. It is the last step of the ordered flow, never a
   * precondition of any earlier one: a failure here must not unbind a device or
   * break a login, so it is reported and dropped.
   *
   * The server is what a campaign audience is resolved from (GoGo-BE#515). It
   * used to be resolved from a `device_tokens` table nothing wrote to, so real
   * users were in no audience at all and three contract-test accounts were the
   * whole of one.
   */
  reportSubscription?: (userId: string) => Promise<void>
  /** Reason codes only. Never a token, never a user id. */
  report?: (event: string) => void
  /**
   * Only for an environment that deliberately runs without identity
   * verification. Off by default: an unverified login is a weaker guarantee
   * wearing the same name, and it must be a decision, not a fallback.
   */
  allowUnverified?: boolean
}

export type IdentitySession = { kind: 'user' | 'guest'; userId?: string | undefined } | null

/**
 * How many times in a row a refused token is replaced before giving up.
 *
 * Observed on the DEV emulator, 2026-09-07: OneSignal answered 401 to a
 * correctly-signed ES256 token, invalidated it, and asked for another. The
 * handler minted one with the same key, which was refused identically — a loop
 * firing every ~5.8 seconds for as long as the app stayed open, one call to
 * GET /v1/notifications/identity each time.
 *
 * The point is that this failure is not transient. If the provider refuses a
 * freshly-signed token, the next one signed with the same key is refused too;
 * the environment is misconfigured and only a person can fix it. Retrying
 * forever burns battery, hammers the API and — worst — hides the fault behind
 * activity. Three attempts, then stop and say so.
 *
 * The counter resets whenever a bind succeeds or the user changes, so a
 * genuinely expired token later in a long session still refreshes normally.
 */
export const MAX_CONSECUTIVE_JWT_REFRESHES = 3

export function createIdentitySession(deps: IdentitySessionDeps) {
  const report = deps.report ?? (() => {})
  let boundUserId: string | null = null
  let expirySubscription: { remove(): void } | null = null
  let consecutiveRefreshes = 0
  let refreshGiveUpReported = false
  /**
   * Every resubscription started so far, settled or not.
   *
   * A set rather than a single slot: rapid A -> B leaves A's confirmation still
   * polling when B's starts, and a single slot would drop A's promise on the
   * floor — both losing the rejection handler and letting a test that awaits
   * "the" resubscription pass on microtask ordering instead of on the guard.
   */
  const resubscriptions = new Set<Promise<void>>()

  async function bind(userId: string): Promise<void> {
    const outcome = await deps.fetchToken()
    if (outcome.kind === 'ok') {
      // The endpoint decides the external id from the session, not the client.
      // Trusting the response over the argument keeps one source of truth.
      await deps.native.loginWithToken(outcome.token.externalId, outcome.token.token)
      boundUserId = userId
      consecutiveRefreshes = 0
      refreshGiveUpReported = false
      report('push_identity_bound')

      // The ordered flow, and the order is the point:
      //   session -> JWT login -> *confirmed* identity -> eligible opt-in.
      //
      // `push_identity_bound` above means the call was made. It does not mean
      // the provider accepted it — under Identity Verification a refused JWT
      // leaves the SDK on a `local-` id, looking otherwise identical. Opting in
      // on the strength of the call returning is how a decision made for one
      // account lands on another.
      //
      // Deliberately not awaited. Confirmation polls the SDK for up to fifteen
      // seconds, and `apply` runs on every session emission — blocking it would
      // hold up the *next* session change, so a logout arriving mid-confirmation
      // would be queued behind the login it is cancelling. The supersede checks
      // inside are what keep it safe, not the caller waiting.
      track(resubscribeIfEligible(userId))
      return
    }
    if (outcome.kind === 'unavailable' && deps.allowUnverified) {
      await deps.native.loginWithoutToken(userId)
      boundUserId = userId
      report('push_identity_unverified')
      return
    }
    // Unbound is the honest state: no subscription is attributed to this user,
    // so nothing is delivered to them rather than delivered unverified.
    report(outcome.kind === 'unavailable' ? 'push_identity_unavailable' : 'push_identity_failed')
  }

  /** Keeps a handle on an in-flight resubscription and swallows its rejection. */
  function track(pending: Promise<void>): void {
    const handled = pending.catch(() => {
      // Resubscription is best-effort and off the session path; a throw here
      // must not surface as an unhandled rejection in the app.
      report('push_resubscribe_failed')
    })
    resubscriptions.add(handled)
    void handled.finally(() => resubscriptions.delete(handled))
  }

  /**
   * Restores the subscription, but only for a login that is still current and
   * only where permission and preference allow it.
   *
   * Never prompts. `eligible` reports what the OS and the person have already
   * decided; asking here would spend the one permission prompt at sign-in,
   * which is exactly the moment it has not been earned.
   */
  async function resubscribeIfEligible(userId: string): Promise<void> {
    if (!deps.confirmIdentity || !deps.optIn) return

    const stillCurrent = () => boundUserId === userId
    const confirmation = await deps.confirmIdentity(userId, stillCurrent)
    if (confirmation.kind !== 'confirmed') return

    // Re-checked after the await: confirmation can take seconds, and the
    // account may have changed inside that window.
    if (!stillCurrent()) {
      report('push_resubscribe_superseded')
      return
    }

    let allowed = false
    try {
      allowed = (await deps.eligible?.()) ?? false
    } catch {
      allowed = false
    }
    if (!stillCurrent()) {
      report('push_resubscribe_superseded')
      return
    }
    if (!allowed) {
      report('push_resubscribe_not_eligible')
      return
    }

    deps.optIn()
    report('push_resubscribed')

    // Only here, and only for a login that is still current. Everything above
    // had to be true first: identity confirmed by the provider, the OS
    // permitting notifications, and this device opted in. Reporting any earlier
    // would put a user in a campaign audience the provider cannot deliver to,
    // which is the failure this exists to end.
    if (!deps.reportSubscription) return
    // The report is an authenticated call, and the account can change while it
    // is in flight; skipping a superseded one keeps the request off the wire
    // rather than relying on the server to sort it out.
    if (!stillCurrent()) {
      report('push_resubscribe_superseded')
      return
    }
    try {
      await deps.reportSubscription(userId)
      report('push_subscription_reported')
    } catch {
      // Best-effort: the device is bound and subscribed either way, and the
      // next login or foreground bind reports again.
      report('push_subscription_report_failed')
    }
  }

  return {
    /** Idempotent. Safe to call on every session emission. */
    async apply(session: IdentitySession): Promise<void> {
      const userId = session?.kind === 'user' ? session.userId : undefined
      if (!userId) {
        if (boundUserId !== null) {
          // Logout, then forget — in that order, so a failure leaves the
          // service believing the device is still bound and tries again.
          await deps.native.logout()
          boundUserId = null
          report('push_identity_logged_out')
        }
        return
      }
      if (boundUserId === userId) return
      // A different person gets a fresh budget: the previous user's refusals
      // say nothing about this one.
      consecutiveRefreshes = 0
      refreshGiveUpReported = false
      if (boundUserId !== null) {
        // Account switch: the previous user's subscription must be released
        // before the next one claims it, or one device answers to two people.
        await deps.native.logout()
        boundUserId = null
        report('push_identity_switched')
      }
      await bind(userId)
    },

    /**
     * The SDK asks for a fresh token when the one it holds expires or is
     * refused. Answering is the retry; not answering leaves the request open,
     * which is why a failed fetch reports and returns rather than throwing into
     * the native callback.
     */
    start(): void {
      expirySubscription ??= deps.native.onJwtExpired((externalId) => {
        void (async () => {
          if (consecutiveRefreshes >= MAX_CONSECUTIVE_JWT_REFRESHES) {
            // Reported where the loop actually stops, and latched.
            //
            // The obvious place — after the last replacement is sent — is
            // wrong, and a test caught it: `respondToJwtExpired` re-enters this
            // handler synchronously, so several invocations are in flight at
            // once and every one of them unwinds past the same check. That
            // logged the give-up three times, which is the noise the cap
            // exists to remove.
            if (!refreshGiveUpReported) {
              refreshGiveUpReported = true
              report('push_identity_refresh_rejected_repeatedly')
            }
            return
          }
          consecutiveRefreshes += 1

          const outcome = await deps.fetchToken()
          if (outcome.kind !== 'ok') {
            report('push_identity_refresh_failed')
            return
          }
          await deps.native.respondToJwtExpired(externalId, outcome.token.token)
          report('push_identity_refreshed')
        })()
      })
    },

    /**
     * Allow the refresh budget to be spent again.
     *
     * The cap stops a loop against a provider that is refusing every token, and
     * the usual cause is a configuration only a person can correct — a key
     * replaced in the dashboard, enforcement toggled. When that is fixed the
     * app is typically still running, already given up, and would stay unbound
     * until the next login or a restart.
     *
     * The caller decides when a retry is warranted; `identity-bootstrap` uses
     * the app returning to the foreground, which is both a natural retry moment
     * and rare enough that it cannot reconstitute the loop.
     */
    resetRefreshBudget(): void {
      consecutiveRefreshes = 0
      refreshGiveUpReported = false
    },

    /**
     * Resolves when every in-flight resubscription has settled, including ones
     * started by a login that has since been superseded.
     *
     * For tests. Nothing in the app waits on this — resubscription is
     * deliberately off the session-change path.
     */
    async settled(): Promise<void> {
      // Loop: settling one can start nothing new here, but a pending A can
      // resolve *after* B was added, and awaiting one snapshot would miss it.
      while (resubscriptions.size > 0) {
        await Promise.all([...resubscriptions])
      }
    },

    stop(): void {
      expirySubscription?.remove()
      expirySubscription = null
      consecutiveRefreshes = 0
      refreshGiveUpReported = false
    },

    /** Test seam only. */
    boundUserId: () => boundUserId,
  }
}
