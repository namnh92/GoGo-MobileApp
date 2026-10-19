/**
 * GoGo-MobileApp#366 (MMP-APP-003) — App Tracking Transparency.
 *
 * The one importer of `expo-tracking-transparency` (ADR 0012). Owner decision
 * 2026-10-19: GoGo asks iOS for permission to track so Tenjin and Adjust can
 * read the IDFA; both SDKs read it themselves once the OS grants it, so nothing
 * here ever reads the identifier.
 *
 * Rules:
 *
 *   - **never throws.** A failed status read or request is `undetermined` for
 *     this launch; the next launch asks again. Consent never breaks a flow;
 *   - **reason codes only.** `consent_tracking:<status>`, nothing else;
 *   - **settled once per launch.** The deferred-link resume waits for the
 *     answer (shape rev 2 D2.3) so an MMP that releases its report after the
 *     answer is not missed. Where ATT does not exist (Android) it is settled
 *     from the start; elsewhere a bound keeps a sheet that never shows from
 *     holding the resume forever.
 */
import * as TrackingTransparency from 'expo-tracking-transparency'

export type TrackingStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable'

export interface TrackingLibrary {
  isAvailable(): boolean
  getTrackingPermissionsAsync(): Promise<{ status: string }>
  requestTrackingPermissionsAsync(): Promise<{ status: string }>
}

export type TrackingConsentDeps = {
  lib: TrackingLibrary
  report?: (event: string) => void
  /** Longest the resume waits on an answer that never comes. */
  settleTimeoutMs?: number
}

/** Long enough for a person to read the sheet and answer the dialog. */
export const TRACKING_SETTLE_TIMEOUT_MS = 120_000

function statusOf(raw: string | undefined): TrackingStatus {
  return raw === 'granted' || raw === 'denied' ? raw : 'undetermined'
}

export function createTrackingConsent(deps: TrackingConsentDeps) {
  const report = deps.report ?? (() => {})
  let available: boolean
  try {
    available = deps.lib.isAvailable()
  } catch {
    available = false
  }

  let markSettled!: () => void
  const settledPromise = new Promise<void>(resolve => {
    markSettled = resolve
  })
  if (!available) {
    markSettled()
  } else {
    const timer = setTimeout(() => {
      report('consent_tracking:settle_timed_out')
      markSettled()
    }, deps.settleTimeoutMs ?? TRACKING_SETTLE_TIMEOUT_MS)
    void settledPromise.then(() => clearTimeout(timer))
  }

  return {
    async status(): Promise<TrackingStatus> {
      if (!available) return 'unavailable'
      try {
        return statusOf((await deps.lib.getTrackingPermissionsAsync()).status)
      } catch {
        return 'undetermined'
      }
    },

    /** Shows the iOS dialog when the OS still allows it; returns the answer. */
    async request(): Promise<TrackingStatus> {
      if (!available) return 'unavailable'
      let status: TrackingStatus
      try {
        status = statusOf((await deps.lib.requestTrackingPermissionsAsync()).status)
      } catch {
        status = 'undetermined'
      }
      report(`consent_tracking:${status}`)
      return status
    },

    /** "Để sau": iOS was not asked; the sheet comes back next launch. */
    later(): void {
      report('consent_tracking:later')
      markSettled()
    },

    /** Nothing more will be asked this launch. Idempotent. */
    settle(): void {
      markSettled()
    },

    /** Resolves once this launch's consent question is over. */
    settled(): Promise<void> {
      return settledPromise
    },
  }
}

export type TrackingConsent = ReturnType<typeof createTrackingConsent>

/** The app's one instance. */
export const trackingConsent = createTrackingConsent({
  lib: TrackingTransparency,
  report: event => {
    if (__DEV__) console.warn(event)
  },
})
