/**
 * NTF-APP-003 (#50) — asking for notification permission at a moment that
 * earns it.
 *
 * Pure and injectable, like the identity service beside it: the SDK arrives as
 * an argument, so every branch below is testable without a device.
 *
 * The rules encode what the platforms actually do, and each one is a way this
 * goes wrong otherwise:
 *
 *   - **never at launch.** The OS prompt can be shown once. Spending it on a
 *     cold start, before the person has any reason to want notifications, is
 *     how an app gets denied permanently by someone who would have said yes
 *     later. Callers pass the moment; this module never fires on its own;
 *   - **ask only when asking is possible.** `canRequestPermission()` is false
 *     once the OS prompt is spent. Calling `requestPermission` then does
 *     nothing on Android and silently resolves false, which reads as "the user
 *     declined just now" when it means "they declined once, months ago";
 *   - **already granted is not a request.** Re-asking a granted device is a
 *     no-op that still costs a round trip and muddies the analytics;
 *   - **`fallbackToSettings` is a decision, not a default.** Sending someone to
 *     the OS settings screen unasked is hostile. The caller says whether this
 *     moment justifies it;
 *   - **granted ≠ subscribed.** OneSignal only counts a device as messageable
 *     once the subscription is opted in. Permission and opt-in are two facts
 *     and this returns both, because "granted but not messageable" is exactly
 *     the state a device sits in otherwise — measured on DEV, where an
 *     adb-granted permission left `messageable_players` at 0.
 */

export type PermissionOutcome =
  /** The prompt was shown and accepted, and the subscription is opted in. */
  | { kind: 'granted' }
  /** Shown and declined. Do not ask again; the OS prompt is spent. */
  | { kind: 'denied' }
  /** Already granted before this call; nothing was shown. */
  | { kind: 'already_granted' }
  /** The OS prompt is spent. Only a trip to Settings can change this. */
  | { kind: 'blocked' }
  /** The SDK failed. Not a user decision — worth trying again later. */
  | { kind: 'unavailable' }

export interface PushPermissionSdk {
  hasPermission(): boolean
  canRequestPermission(): Promise<boolean>
  requestPermission(fallbackToSettings: boolean): Promise<boolean>
  optIn(): void
}

export type PushPermissionDeps = {
  sdk: PushPermissionSdk
  /** Reason codes only — never a user id, never a token. */
  report?: (event: string) => void
}

export function createPushPermission(deps: PushPermissionDeps) {
  const report = deps.report ?? (() => {})

  return {
    /** What the OS thinks right now, without asking anyone anything. */
    status(): 'granted' | 'askable' | 'unknown' {
      try {
        return deps.sdk.hasPermission() ? 'granted' : 'askable'
      } catch {
        return 'unknown'
      }
    },

    /**
     * Ask. `fallbackToSettings` sends a user whose prompt is spent to the OS
     * settings screen — appropriate when they just tapped "turn on
     * notifications", hostile when they did not.
     */
    async request(options: { fallbackToSettings?: boolean } = {}): Promise<PermissionOutcome> {
      try {
        if (deps.sdk.hasPermission()) {
          // Opt in anyway: a device can hold the OS permission and still be
          // opted out of the provider, which is the state that produces
          // "granted but nothing arrives".
          deps.sdk.optIn()
          report('push_permission_already_granted')
          return { kind: 'already_granted' }
        }

        if (!(await deps.sdk.canRequestPermission())) {
          report('push_permission_blocked')
          return { kind: 'blocked' }
        }

        const granted = await deps.sdk.requestPermission(options.fallbackToSettings ?? false)
        if (!granted) {
          report('push_permission_denied')
          return { kind: 'denied' }
        }

        // Granted is not subscribed. Opt-in is what makes the device
        // messageable, and it is the step whose absence is invisible.
        deps.sdk.optIn()
        report('push_permission_granted')
        return { kind: 'granted' }
      } catch {
        report('push_permission_unavailable')
        return { kind: 'unavailable' }
      }
    },
  }
}
