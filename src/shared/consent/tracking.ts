/**
 * GoGo-MobileApp#366 (MMP-APP-003) — App Tracking Transparency.
 *
 * The one importer of `expo-tracking-transparency` (ADR 0012). Owner decision
 * 2026-10-19: GoGo asks iOS for permission to track so the MMP SDKs can read
 * the IDFA; they read it themselves once the OS grants it, so nothing here ever
 * reads the identifier.
 *
 * Rules:
 *
 *   - **iOS only.** The library's `isAvailable()` is true on Android too (its
 *     native module is there, and it answers `granted`), so availability is
 *     iOS *and* the module. Elsewhere the question is settled from the start;
 *   - **never throws.** A failed status read or request is `undetermined` for
 *     this launch; the next launch asks again;
 *   - **reason codes only**, in release builds too — device acceptance reads
 *     them (`consent_tracking:<status>`);
 *   - **settled means over.** The deferred-link resume waits for it (shape rev
 *     2 D2.3). It resolves only in a terminal state: no ATT here, iOS already
 *     answered, the person answered, or chose "Để sau". No clock ends it: the
 *     gate reaches one of those as soon as someone is on a main screen, and
 *     until then nobody is where a deferred link could open anyway.
 */
import * as TrackingTransparency from 'expo-tracking-transparency'
import { Platform } from 'react-native'

export type TrackingStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable'

export interface TrackingLibrary {
  isAvailable(): boolean
  getTrackingPermissionsAsync(): Promise<{ status: string }>
  requestTrackingPermissionsAsync(): Promise<{ status: string }>
}

export type TrackingConsentDeps = {
  lib: TrackingLibrary
  platform: string
  report?: (event: string) => void
  /** A status read that does not answer within this is `undetermined`. */
  statusTimeoutMs?: number
}

/** A permission read is local; one this slow is broken, not busy. */
export const TRACKING_STATUS_TIMEOUT_MS = 5_000

function statusOf(raw: string | undefined): TrackingStatus {
  return raw === 'granted' || raw === 'denied' ? raw : 'undetermined'
}

export function createTrackingConsent(deps: TrackingConsentDeps) {
  const report = deps.report ?? (() => {})
  let available = false
  try {
    available = deps.platform === 'ios' && deps.lib.isAvailable()
  } catch {
    available = false
  }

  let markSettled!: () => void
  const settledPromise = new Promise<void>(resolve => {
    markSettled = resolve
  })
  if (!available) markSettled()

  return {
    async status(): Promise<TrackingStatus> {
      if (!available) return 'unavailable'
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const read = deps.lib.getTrackingPermissionsAsync().then(result => statusOf(result.status))
        const late = new Promise<TrackingStatus>(resolve => {
          timer = setTimeout(() => resolve('undetermined'), deps.statusTimeoutMs ?? TRACKING_STATUS_TIMEOUT_MS)
        })
        return await Promise.race([read, late])
      } catch {
        return 'undetermined'
      } finally {
        clearTimeout(timer)
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
  platform: Platform.OS,
  // Reason codes only, so release builds keep them: ATT-1/ATT-2 read them.
  report: event => console.warn(event),
})
