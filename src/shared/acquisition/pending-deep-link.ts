/**
 * LNK-APP-001 (#56) — the deferred half of a deferred deep link.
 *
 * A share link opened by someone without the app goes to the store. The app
 * that eventually launches was never handed a URL: the attribution SDK reports
 * it after install, asynchronously, once — and it may arrive before the app is
 * ready to navigate, before the session has hydrated, or after the user has
 * already started doing something else. Losing it means the person who
 * followed a link to a specific place lands on the home screen instead.
 *
 * So it is written down, and read once.
 *
 * Rules the shape encodes, each of which is a way this goes wrong otherwise:
 *
 *   - **exactly once.** `take()` reads and clears in one step, so a resume
 *     racing a cold-start navigation cannot fire twice;
 *   - **first writer wins.** The SDK's report and a real cold-start URL can
 *     both arrive; the real URL is the better signal and is handled by the
 *     normal path, so a pending entry never overwrites one already stored;
 *   - **it expires.** An install attributed a week ago is not an intent any
 *     more. Resuming it would teleport someone who opened the app to browse;
 *   - **only what parses.** An unroutable URL is discarded at write time, so a
 *     junk value cannot sit in storage failing forever;
 *   - **never a credential in the clear.** A ROOM_INVITE slug *is* the invite
 *     code, so the entry holds the parsed action, not the raw URL, and it goes
 *     to secure storage rather than plain key-value storage.
 */
import { parseDeepLink, type DeepLinkAction } from '@/shared/navigation/deep-link'

export const PENDING_DEEP_LINK_KEY = 'gogo.pending_deep_link'

/** Beyond this an install is history, not an intention. */
export const PENDING_DEEP_LINK_TTL_MS = 24 * 60 * 60 * 1000

type StoredEntry = { action: DeepLinkAction; storedAt: number }

export interface PendingDeepLinkStorage {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

export type PendingDeepLinkDeps = {
  storage: PendingDeepLinkStorage
  now?: () => number
  /** Reason codes only — never the URL, which can carry an invite code. */
  report?: (event: string) => void
}

export function createPendingDeepLinkStore(deps: PendingDeepLinkDeps) {
  const now = deps.now ?? (() => Date.now())
  const report = deps.report ?? (() => {})

  async function read(): Promise<StoredEntry | null> {
    const raw = await deps.storage.get(PENDING_DEEP_LINK_KEY)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as StoredEntry
      if (!parsed?.action?.kind || typeof parsed.storedAt !== 'number') return null
      return parsed
    } catch {
      // Unreadable is the same as absent, and it must not be left behind to
      // fail again on every launch.
      return null
    }
  }

  return {
    /**
     * Record a deferred link. Returns whether it was stored, so a caller can
     * tell "kept" from "ignored" without reading back.
     */
    async remember(url: string | null | undefined): Promise<boolean> {
      const action = parseDeepLink(url)
      if (action.kind === 'unknown') {
        report(`deferred_link_discarded:${action.reason}`)
        return false
      }
      const existing = await read()
      if (existing) {
        // First writer wins: a real cold-start URL is the better signal and is
        // already being handled by the normal path.
        report('deferred_link_ignored:already_pending')
        return false
      }
      await deps.storage.set(
        PENDING_DEEP_LINK_KEY,
        JSON.stringify({ action, storedAt: now() } satisfies StoredEntry),
      )
      report(`deferred_link_stored:${action.kind}`)
      return true
    },

    /**
     * Read and clear in one step. Returns null when nothing is pending, when
     * the entry expired, or when storage held something unreadable — and clears
     * in the last two cases so it cannot fail forever.
     */
    async take(): Promise<DeepLinkAction | null> {
      const entry = await read()
      if (!entry) {
        await deps.storage.remove(PENDING_DEEP_LINK_KEY)
        return null
      }
      await deps.storage.remove(PENDING_DEEP_LINK_KEY)
      if (now() - entry.storedAt > PENDING_DEEP_LINK_TTL_MS) {
        report('deferred_link_expired')
        return null
      }
      report(`deferred_link_resumed:${entry.action.kind}`)
      return entry.action
    },

    /** For a sign-out, where another person's pending intent must not survive. */
    async clear(): Promise<void> {
      await deps.storage.remove(PENDING_DEEP_LINK_KEY)
    },
  }
}
