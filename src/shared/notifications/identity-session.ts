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

export type IdentitySessionDeps = {
  native: OneSignalIdentity
  fetchToken: () => Promise<IdentityFetchOutcome>
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

export function createIdentitySession(deps: IdentitySessionDeps) {
  const report = deps.report ?? (() => {})
  let boundUserId: string | null = null
  let expirySubscription: { remove(): void } | null = null

  async function bind(userId: string): Promise<void> {
    const outcome = await deps.fetchToken()
    if (outcome.kind === 'ok') {
      // The endpoint decides the external id from the session, not the client.
      // Trusting the response over the argument keeps one source of truth.
      await deps.native.loginWithToken(outcome.token.externalId, outcome.token.token)
      boundUserId = userId
      report('push_identity_bound')
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

    stop(): void {
      expirySubscription?.remove()
      expirySubscription = null
    },

    /** Test seam only. */
    boundUserId: () => boundUserId,
  }
}
