/**
 * GoGo-MobileApp#367 (MMP-APP-001) — Adjust SDK bootstrap, beside Tenjin
 * (ADR 0011). Acquisition only, like Tenjin's: no GoGo identity, no events in
 * phase 1 (shape D1), navigation stays GoGo's.
 *
 *   - **environment from the flavour, in code.** prod → production, dev and
 *     stag → sandbox (owner Q4, 2026-10-19). No config can make a dev build
 *     report into production;
 *   - **ATT is GoGo's question** (`shared/consent/tracking.ts`, ADR 0012). The
 *     SDK only waits up to 60 s for the answer before its first send, so the
 *     install carries the IDFA when the person allows it on that first screen;
 *     it never asks on its own;
 *   - **once per process, never throws.** A failed init is a lost measurement,
 *     not a failed launch.
 */
export type AdjustEnvironment = 'sandbox' | 'production'

/** The slice of `AdjustConfig` this app uses — kept small so the test fake is honest. */
export interface AdjustConfigLike {
  disableDeferredDeeplinkOpening(): void
  setAttConsentWaitingInterval(seconds: number): void
  setDeferredDeeplinkCallback(callback: (payload: { deeplink: string }) => void): void
  setAttributionCallback(callback: (attribution: unknown) => void): void
}

export interface AdjustSdkLike {
  createConfig(appToken: string, environment: AdjustEnvironment): AdjustConfigLike
  initSdk(config: AdjustConfigLike): void
}

/** Seconds the SDK holds its first package for the ATT answer (shape rev 2 D5.4). */
export const ADJUST_ATT_WAIT_SECONDS = 60

export function adjustEnvironmentFor(flavor: unknown): AdjustEnvironment {
  return flavor === 'prod' ? 'production' : 'sandbox'
}

/** The token as a decision: a real token, or nothing to start. */
export function adjustTokenOf(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9]{8,32}$/.test(value) ? value : null
}

export function createAdjustInitializer(deps: {
  sdk: AdjustSdkLike
  flavor: unknown
  onDeferredLink: (payload: unknown) => void
  onAttribution: () => void
  onUnavailable?: (event: string) => void
}) {
  let started = false
  return (token: string): boolean => {
    if (started) return true
    started = true
    try {
      const config = deps.sdk.createConfig(token, adjustEnvironmentFor(deps.flavor))
      config.disableDeferredDeeplinkOpening()
      config.setAttConsentWaitingInterval(ADJUST_ATT_WAIT_SECONDS)
      config.setDeferredDeeplinkCallback(payload => {
        try {
          deps.onDeferredLink(payload)
        } catch {
          deps.onUnavailable?.('acquisition_adjust_callback_failed')
        }
      })
      // Reason only: the attribution payload names a campaign, never logged.
      config.setAttributionCallback(() => {
        try {
          deps.onAttribution()
        } catch {
          deps.onUnavailable?.('acquisition_adjust_callback_failed')
        }
      })
      deps.sdk.initSdk(config)
      return true
    } catch {
      deps.onUnavailable?.('acquisition_adjust_unavailable')
      return false
    }
  }
}
