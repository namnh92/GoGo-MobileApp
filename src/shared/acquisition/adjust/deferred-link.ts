/**
 * GoGo-MobileApp#367 (MMP-APP-001) — Adjust as the second writer into the one
 * `PendingDeepLinkStore` (shape D2). The SDK never navigates
 * (`disableDeferredDeeplinkOpening`); GoGo's router does, through the resume.
 *
 * Rules:
 *
 *   - **only GoGo's own links** — this build's scheme or GoGo's web host
 *     (`own-link.ts`); then the store gates as for Tenjin: it parses, lets the
 *     first writer win (whichever reports first) and refuses a link already
 *     consumed on this install. Its operations run one at a time, so the two
 *     writers cannot both see an empty slot;
 *   - **one launch window.** Adjust keeps its callbacks for the life of the
 *     process and may report again when the attribution changes. A report that
 *     lands after the resume has taken its one look would teleport someone who
 *     is already using the app, so the sink closes when it settles and later
 *     reports are dropped (`…ignored:late`);
 *   - **settled is what the resume waits for.** It resolves on a definitive
 *     event only: Adjust delivered a deferred link, another writer has already
 *     won (`close`), Adjust is not running (`skip`), or the window ended. An
 *     attribution callback is not one: the SDK documents no "no deferred link"
 *     signal, and a link may follow it by an unknown delay (PR #369 Astra F-04);
 *   - **the URL is never reported.** A ROOM_INVITE slug is the invite code.
 */

/** iOS waits for the ATT answer (`setAttConsentWaitingInterval(60)`) before sending. */
export const ADJUST_WINDOW_MS = { ios: 70_000, android: 10_000 } as const

export type AdjustDeferredLinkDeps = {
  store: { remember(url: string, source?: string): Promise<boolean> }
  windowMs: number
  /** This build's own links only (`own-link.ts`). */
  isOwnLink: (url: string) => boolean
  /** Reason codes only — never the URL. */
  report?: (event: string) => void
}

function urlOf(payload: unknown): string | null {
  if (typeof payload === 'string') return payload
  if (payload && typeof payload === 'object') {
    const value = (payload as { deeplink?: unknown }).deeplink
    if (typeof value === 'string') return value
  }
  return null
}

export function createAdjustDeferredLinkSink(deps: AdjustDeferredLinkDeps) {
  const report = deps.report ?? (() => {})
  let open = true
  let markSettled!: () => void
  const settled = new Promise<void>(resolve => {
    markSettled = resolve
  })
  const window = setTimeout(() => close('acquisition_adjust_window_ended'), deps.windowMs)

  function close(event: string) {
    if (!open) return
    open = false
    clearTimeout(window)
    report(event)
    markSettled()
  }

  return {
    /** `setDeferredDeeplinkCallback`. Never throws into the SDK's emitter. */
    onDeferredLink(payload: unknown): void {
      if (!open) {
        report('deferred_link_ignored:late:adjust')
        return
      }
      const url = urlOf(payload)
      if (!url) {
        close('deferred_link_discarded:unparseable:adjust')
        return
      }
      if (!deps.isOwnLink(url)) {
        close('deferred_link_discarded:foreign:adjust')
        return
      }
      // Closed now, so a second report while this write is in flight is late.
      open = false
      clearTimeout(window)
      void deps.store
        .remember(url, 'adjust')
        .then(stored => report(stored ? 'acquisition_adjust_deferred_link_stored' : 'acquisition_adjust_deferred_link_ignored'))
        .catch(() => report('acquisition_adjust_deferred_link_store_failed'))
        .finally(() => markSettled())
    },

    /** `setAttributionCallback`: a reason code only — not a "no link" signal. */
    onAttribution(): void {
      report('acquisition_adjust_attribution')
    },

    /**
     * Adjust is not running this launch (no token, `off`, init failed), or
     * another writer already won (PR #369 Astra F-03): stop waiting.
     */
    skip(event: string): void {
      close(event)
    },

    settled(): Promise<void> {
      return settled
    },
  }
}

export type AdjustDeferredLinkSink = ReturnType<typeof createAdjustDeferredLinkSink>
