/**
 * GoGo-MobileApp#367 (MMP-APP-001) — Adjust as the second writer into the one
 * `PendingDeepLinkStore` (shape D2). The SDK never navigates
 * (`disableDeferredDeeplinkOpening`); GoGo's router does, through the resume.
 *
 * Rules:
 *
 *   - **the store is the gate.** `remember()` parses (only a GoGo link is kept),
 *     lets the first writer win (Tenjin or Adjust, whichever reports first), and
 *     refuses a link already consumed on this install;
 *   - **one launch window.** Adjust keeps its callbacks for the life of the
 *     process and may report again when the attribution changes. A report that
 *     lands after the resume has taken its one look would teleport someone who
 *     is already using the app, so the sink closes when it settles and later
 *     reports are dropped (`…ignored:late`);
 *   - **settled is what the resume waits for.** It resolves when Adjust has
 *     answered — a deferred link, or an attribution with none — or when the
 *     window ends. An attribution arriving first is given a short grace, because
 *     the SDK delivers the deferred link from the same response and the order of
 *     the two callbacks is not documented;
 *   - **the URL is never reported.** A ROOM_INVITE slug is the invite code.
 */

/** iOS waits for the ATT answer (`setAttConsentWaitingInterval(60)`) before sending. */
export const ADJUST_WINDOW_MS = { ios: 70_000, android: 10_000 } as const

/** After an attribution, how long a deferred link from the same response may lag. */
export const ADJUST_ATTRIBUTION_GRACE_MS = 2_000

export type AdjustDeferredLinkDeps = {
  store: { remember(url: string): Promise<boolean> }
  windowMs: number
  graceMs?: number
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
  let grace: ReturnType<typeof setTimeout> | undefined
  let markSettled!: () => void
  const settled = new Promise<void>(resolve => {
    markSettled = resolve
  })
  const window = setTimeout(() => close('acquisition_adjust_window_ended'), deps.windowMs)

  function close(event: string) {
    if (!open) return
    open = false
    clearTimeout(window)
    clearTimeout(grace)
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
      // Closed now, so a second report while this write is in flight is late.
      open = false
      clearTimeout(window)
      clearTimeout(grace)
      void deps.store
        .remember(url)
        .then(stored => report(stored ? 'acquisition_adjust_deferred_link_stored' : 'acquisition_adjust_deferred_link_ignored'))
        .catch(() => report('acquisition_adjust_deferred_link_store_failed'))
        .finally(() => markSettled())
    },

    /** `setAttributionCallback`: Adjust has answered; a deferred link may follow. */
    onAttribution(): void {
      if (!open || grace) return
      grace = setTimeout(() => close('acquisition_adjust_no_deferred_link'), deps.graceMs ?? ADJUST_ATTRIBUTION_GRACE_MS)
    },

    /** Adjust is not running this launch (no token, `off`, or init failed). */
    skip(event: string): void {
      close(event)
    },

    settled(): Promise<void> {
      return settled
    },
  }
}

export type AdjustDeferredLinkSink = ReturnType<typeof createAdjustDeferredLinkSink>
