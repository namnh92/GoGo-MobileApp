/**
 * LNK-APP-001 (#56) — the half that fills `PendingDeepLinkStore`.
 *
 * The store knows how to hold a deferred link and hand it back exactly once.
 * Nothing was writing to it. This is the writer: Tenjin reports what the
 * install was attributed to, and if that carries a GoGo link, it is the link
 * the person followed before they had the app.
 *
 * `getAttributionInfo` is a one-shot callback pair, not a stream, and it can
 * answer with an empty object on a plain organic install — that is the normal
 * case, not a failure. The three things worth encoding:
 *
 *   - **the key is not stable across sources.** Tenjin returns whatever the
 *     referrer carried, and the deep link has appeared under several names
 *     depending on how the campaign was built. Every candidate is tried, in
 *     the order most-specific first, and the first that parses into a real
 *     GoGo action wins;
 *   - **only a GoGo link.** `parseDeepLink` is the gate. An advertiser's
 *     tracking URL is not a destination, and handing one to the router would
 *     navigate the app to somewhere that is not in the app;
 *   - **it never throws into startup.** Attribution failing is a lost
 *     attribution, never a failed launch — the same rule the initializer
 *     already follows;
 *   - **it always settles.** On the DEV emulator neither callback fired at
 *     all: with no advertising id and no Play referrer, the native
 *     `getAttributionInfo` completed its retrieval and answered nothing. A
 *     promise that never settles is a leak and, worse, a caller that can never
 *     learn "there is no deferred link". So the wait is bounded.
 *
 * Reported values are provider data about this install. Reason codes are
 * logged; the URL is not, because a ROOM_INVITE slug is the invite code.
 */
import { parseDeepLink } from '@/shared/navigation/deep-link'

/**
 * Keys Tenjin has been observed to carry a deferred link under. Ordered
 * most-specific first so a campaign that sets both a tracking URL and a
 * destination cannot resolve to the tracking URL.
 */
export const DEFERRED_LINK_KEYS = [
  'deferred_deeplink_url',
  'deeplink_url',
  'deferred_deeplink',
  'deep_link',
  'url',
] as const

export interface AttributionSdk {
  getAttributionInfo(
    onSuccess: (info: Record<string, unknown>) => void,
    onError: (error: string) => void,
  ): void
}

export interface DeferredLinkSink {
  /**
   * First writer wins and unparseable input is dropped — see the store.
   * The boolean says which happened, so "Tenjin reported a link" and "we kept
   * it" stay separable: a real cold-start URL already in the store beats an
   * attribution report, and that is a normal outcome, not a lost one.
   */
  remember(url: string): Promise<boolean>
}

export type DeferredLinkDeps = {
  sdk: AttributionSdk
  store: DeferredLinkSink
  /** Reason codes only — never the URL. */
  report?: (event: string) => void
  /**
   * How long to wait for the SDK before calling it silence. Generous, because
   * the answer arrives after a network round trip and a wrong "no link" is
   * worse than a slow one — nothing is blocked on this.
   */
  timeoutMs?: number
}

/** Long enough for a cold-start attribution round trip, short enough to end. */
export const ATTRIBUTION_TIMEOUT_MS = 10_000

/**
 * Picks the deferred link out of an attribution payload, or null.
 *
 * Exported for its own tests: this is the part that has to cope with a shape
 * the SDK does not document and a provider can change.
 */
export function deferredLinkFrom(info: Record<string, unknown>): string | null {
  for (const key of DEFERRED_LINK_KEYS) {
    const value = info[key]
    if (typeof value !== 'string' || !value.trim()) continue
    // A value that is not one of ours is not a destination. Checked here
    // rather than at the store so a tracking URL under `url` does not stop
    // the loop before a real link under a later key is seen.
    if (parseDeepLink(value).kind !== 'unknown') return value
  }
  return null
}

export function createDeferredLinkCollector(deps: DeferredLinkDeps) {
  const report = deps.report ?? (() => {})
  const timeoutMs = deps.timeoutMs ?? ATTRIBUTION_TIMEOUT_MS

  /** Resolves once the SDK has answered, or once it is clear it will not. */
  return function collect(): Promise<void> {
    return new Promise<void>((resolve) => {
      // One resolution only. The native side already guards its callback pair
      // with an AtomicBoolean, but a provider that called both would otherwise
      // leave this promise's contract depending on the SDK's good behaviour.
      let settled = false
      let timer: ReturnType<typeof setTimeout> | undefined
      const finish = (event: string) => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        report(event)
        resolve()
      }

      // Observed on the DEV emulator: neither callback fires when there is no
      // advertising id and no Play referrer.
      timer = setTimeout(() => finish('acquisition_attribution_timed_out'), timeoutMs)

      try {
        deps.sdk.getAttributionInfo(
          (info) => {
            const url = info && typeof info === 'object' ? deferredLinkFrom(info) : null
            if (!url) {
              // The ordinary organic install. Not a failure.
              finish('acquisition_no_deferred_link')
              return
            }
            deps.store
              .remember(url)
              .then((stored) =>
                finish(stored ? 'acquisition_deferred_link_stored' : 'acquisition_deferred_link_ignored'),
              )
              .catch(() => finish('acquisition_deferred_link_store_failed'))
          },
          () => finish('acquisition_attribution_failed'),
        )
      } catch {
        finish('acquisition_attribution_unavailable')
      }
    })
  }
}
