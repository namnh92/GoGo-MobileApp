/**
 * NTF-APP-004 (#160) — releasing this device's push subscription on logout.
 *
 * `logout()` is not enough, and the SDK says so. OneSignal 5.x documents it as
 * removing the `external_id` from the current subscription and resetting the
 * `onesignal_id` to a fresh anonymous user — it **does not unsubscribe**. The
 * subscription keeps its token and stays messageable; only its owner changes.
 * `optOut()` is the call that unsubscribes, setting `notification_types` to
 * `-2` server-side, and it acts on this subscription alone: the user's other
 * devices, and the user record itself, are untouched. That is exactly the scope
 * we want, and the reason this is a deliberate second call rather than a
 * re-implementation of something the SDK already does.
 *
 * Two properties this file exists to guarantee, both learned the hard way:
 *
 *   - **logging out must not hang on a provider.** Someone tapping "sign out"
 *     asked for their session to end on this phone. Reaching OneSignal is
 *     best-effort; a network that is down must not hold the local sign-out
 *     hostage. So the provider work is bounded, and the bound is short enough
 *     to be invisible;
 *   - **a slow release must not un-release a later login.** If the opt-out is
 *     still in flight when the next person signs in, its completion has to be
 *     dropped rather than applied — otherwise it lands on *their* subscription
 *     and silently unsubscribes the new account. Every release carries the
 *     generation it belongs to, and a stale one does nothing.
 *
 * Nothing here reports success from the native call returning. `optOut()` is
 * fire-and-forget on both platforms — it enqueues an operation and returns —
 * so "we asked" is the honest claim, and it is the one the reason codes make.
 */

export interface PushSubscriptionPort {
  /** Unsubscribes *this* subscription. Never touches the user or other devices. */
  optOut(): void
  /** Whether the SDK currently considers this device opted in. */
  isOptedIn(): Promise<boolean>
}

export type ReleaseDeps = {
  subscription: PushSubscriptionPort
  /** Reason codes only — never a user id, never a token. */
  report?: (event: string) => void
  /**
   * How long to wait for the SDK to reflect the opt-out before giving up on
   * *observing* it. The opt-out itself is already enqueued and will be sent
   * whenever the provider is reachable again; this bounds only how long the
   * person waits to be signed out.
   */
  confirmTimeoutMs?: number
}

/** Short: this sits between a tap and a screen change. */
export const RELEASE_CONFIRM_TIMEOUT_MS = 2_000

export type ReleaseOutcome =
  /** The SDK reports the device opted out. */
  | 'released'
  /** Asked, but not confirmed within the bound. Enqueued; will still send. */
  | 'pending'
  /** Already opted out — nothing to do. */
  | 'already_released'
  /** The SDK threw. Sign-out continues regardless. */
  | 'unavailable'

export function createPushRelease(deps: ReleaseDeps) {
  const report = deps.report ?? (() => {})
  const timeout = deps.confirmTimeoutMs ?? RELEASE_CONFIRM_TIMEOUT_MS

  /**
   * Bumped on every release and every claim. A release only applies its result
   * if the generation it started in is still current.
   */
  let generation = 0

  return {
    /**
     * Called when a login supersedes whatever came before, so an in-flight
     * release cannot report against the new account.
     */
    invalidate(): void {
      generation += 1
    },

    /** Never rejects: sign-out proceeds whatever the provider does. */
    async release(): Promise<ReleaseOutcome> {
      const mine = (generation += 1)
      const stale = () => generation !== mine

      try {
        if (await deps.subscription.isOptedIn().catch(() => true)) {
          deps.subscription.optOut()
        } else {
          report('push_release_already_released')
          return 'already_released'
        }
      } catch {
        report('push_release_unavailable')
        return 'unavailable'
      }

      // Poll rather than trust the return: optOut() enqueues and returns
      // immediately on both platforms, so its returning proves only that we
      // asked.
      const deadline = Date.now() + timeout
      while (Date.now() < deadline) {
        if (stale()) {
          // A newer login owns the subscription now. Saying nothing is the
          // point: reporting here would attribute this release to them.
          report('push_release_superseded')
          return 'pending'
        }
        try {
          if (!(await deps.subscription.isOptedIn())) {
            if (stale()) {
              report('push_release_superseded')
              return 'pending'
            }
            report('push_release_released')
            return 'released'
          }
        } catch {
          report('push_release_unavailable')
          return 'unavailable'
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // Not confirmed, but the SDK holds the operation and will send it. The
      // person is signed out locally either way.
      report('push_release_pending')
      return 'pending'
    },
  }
}
