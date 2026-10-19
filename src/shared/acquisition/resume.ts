/**
 * GoGo-MobileApp#364 (MMP-APP-002) — the reader `PendingDeepLinkStore` never
 * had. The collector wrote a deferred link down; nothing took it back out, so a
 * person who installed from an invite still landed on Home.
 *
 * Rules, each a way this goes wrong otherwise:
 *
 *   - **once per process.** The session can become ready more than once in one
 *     run (sign out, sign in). The link is an install's intent, handed over at
 *     the first chance only;
 *   - **after this launch's report.** The SDK answers a few seconds after
 *     start. Taking before it settles finds nothing and leaves today's link for
 *     tomorrow's launch;
 *   - **a real URL wins.** When the app was opened by a link, Expo Router has
 *     already routed it. The pending entry is consumed and dropped, never
 *     routed on top — that would navigate twice for one tap;
 *   - **it never throws.** A lost deferred link is a lost shortcut, not a
 *     failed launch.
 */
import { parseDeepLink, type DeepLinkAction } from '@/shared/navigation/deep-link'

export type DeferredLinkResumeDeps = {
  store: { take(): Promise<DeepLinkAction | null> }
  /** This launch's attribution report has been written down or given up on. */
  settled: () => Promise<void>
  /** The URL that launched the app, if any (`Linking.getInitialURL`). */
  initialUrl: () => Promise<string | null>
  open: (action: DeepLinkAction) => void
  /** Reason codes only — never the link. */
  report?: (event: string) => void
}

export function createDeferredLinkResume(deps: DeferredLinkResumeDeps) {
  const report = deps.report ?? (() => {})
  let started = false

  return async function resume(): Promise<void> {
    if (started) return
    started = true
    try {
      await deps.settled()
      const action = await deps.store.take()
      if (!action) return
      if (parseDeepLink(await deps.initialUrl()).kind !== 'unknown') {
        report('deferred_link_skipped:cold_start_url')
        return
      }
      deps.open(action)
    } catch {
      report('deferred_link_resume_failed')
    }
  }
}
