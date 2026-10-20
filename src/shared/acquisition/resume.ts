/**
 * GoGo-MobileApp#364 (MMP-APP-002) — the reader `PendingDeepLinkStore` never
 * had. The collector wrote a deferred link down; nothing took it back out, so a
 * person who installed from an invite still landed on Home.
 *
 * Rules, each a way this goes wrong otherwise:
 *
 *   - **at most one open per process.** The session can become ready more than
 *     once in one run (sign out, sign in). The link is an install's intent,
 *     handed over at the first chance only;
 *   - **to the session that asked.** The wait for the report, and the read of
 *     the launch URL, can outlast a sign-out. A run whose session changed
 *     before it took the link stands down and lets the next ready session try;
 *     one whose session changed after it took the link drops it — checked last
 *     of all, right before the open;
 *   - **the session turned away gets its turn.** A session that became ready
 *     while an earlier run was still waiting was refused by the latch. When
 *     that run stands down, it runs once more for whoever is signed in now,
 *     instead of leaving the link for the next launch;
 *   - **only over this install's state.** When the install reset failed
 *     (`install-scope.ts`), the store may hold a previous install's link. It
 *     is neither taken nor opened; the next launch resets again;
 *   - **a tap that launched the app wins.** A queued notification tap is what
 *     the person did now; the link is from before the install. It is consumed
 *     and dropped, like a launch URL;
 *   - **after this launch's report.** The SDK answers a few seconds after
 *     start. Taking before it settles finds nothing and leaves today's link for
 *     tomorrow's launch;
 *   - **a real URL wins.** When the app was opened by a link, Expo Router has
 *     already routed it. The pending entry is consumed and dropped, never
 *     routed on top — that would navigate twice for one tap;
 *   - **it never throws.** A lost deferred link is a lost shortcut, not a
 *     failed launch.
 */
import { parseDeepLink, systemPathFor, type DeepLinkAction } from '@/shared/navigation/deep-link'

export type DeferredLinkResumeDeps = {
  store: { take(): Promise<DeepLinkAction | null> }
  /** This launch's attribution report has been written down or given up on. */
  settled: () => Promise<void>
  /** The URL that launched the app, if any (`Linking.getInitialURL`). */
  initialUrl: () => Promise<string | null>
  open: (action: DeepLinkAction) => void
  /** Who is signed in: changes on sign-out or account switch, null when nobody is. */
  sessionKey?: () => string | null
  /** A queued notification tap is opening this launch. */
  launchClaimed?: () => boolean
  /** This launch's install reset succeeded; read once `settled` has resolved. */
  installScoped?: () => boolean
  /** Reason codes only — never the link. */
  report?: (event: string) => void
}

export function createDeferredLinkResume(deps: DeferredLinkResumeDeps) {
  const report = deps.report ?? (() => {})
  const sessionKey = deps.sessionKey ?? (() => '')
  const launchClaimed = deps.launchClaimed ?? (() => false)
  const installScoped = deps.installScoped ?? (() => true)
  let started = false
  /** A ready session asked while a run was in flight and was turned away. */
  let askedAgain = false

  /** Resolves to whether the run stood down for a changed session. */
  async function run(): Promise<boolean> {
    const owner = sessionKey()
    try {
      await deps.settled()
      if (sessionKey() !== owner || owner === null) {
        report('deferred_link_skipped:session_changed')
        return true
      }
      if (!installScoped()) {
        report('deferred_link_skipped:install_scope_failed')
        return false
      }
      const action = await deps.store.take()
      if (!action) return false
      if (sessionKey() !== owner) {
        report('deferred_link_dropped:session_changed')
        return false
      }
      if (launchClaimed()) {
        report('deferred_link_skipped:push_launch')
        return false
      }
      // Through the same rewrite Expo Router's native intent applies, so a
      // scheme invite (`gogo://room/<code>`) is recognised as the launch link.
      const launch = await deps.initialUrl()
      if (launch && parseDeepLink(systemPathFor(launch)).kind !== 'unknown') {
        report('deferred_link_skipped:cold_start_url')
        return false
      }
      // The last look, after the last await: a sign-out fits in that gap too.
      if (sessionKey() !== owner) {
        report('deferred_link_dropped:session_changed')
        return false
      }
      deps.open(action)
    } catch {
      report('deferred_link_resume_failed')
    }
    return false
  }

  return async function resume(): Promise<void> {
    if (started) {
      askedAgain = true
      return
    }
    started = true
    do {
      askedAgain = false
      if (!(await run())) return
      // Stood down: un-latch, and run again only for a session that asked
      // meanwhile — it is signed in now, and the key it reads is its own.
    } while (askedAgain)
    started = false
  }
}
