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
 *     to secure storage rather than plain key-value storage;
 *   - **once per install, not once per launch.** An attribution SDK answers
 *     with the install's attribution whenever it is asked, so the same link is
 *     reported again on every launch. Without a record of what was already
 *     resumed, a link taken today is stored again tomorrow and the person is
 *     sent back to it each time they open the app (GoGo-MobileApp#364). The
 *     record is a short list of digests, never the actions, and it outlives a
 *     sign-out on purpose: the report belongs to the install, so clearing it
 *     would hand the same link to whoever signs in next;
 *   - **a sign-out retires what is pending.** `clear()` records the pending
 *     action as consumed before dropping it, so the next launch's repeat report
 *     cannot bring it back for someone else. A report that arrives after the
 *     sign-out, with nothing pending, is not retired: it is the install's
 *     link, and it opens for whoever is first signed in on a later launch.
 */
import { parseDeepLink, type DeepLinkAction } from '@/shared/navigation/deep-link'

export const PENDING_DEEP_LINK_KEY = 'gogo.pending_deep_link'

/** Beyond this an install is history, not an intention. */
export const PENDING_DEEP_LINK_TTL_MS = 24 * 60 * 60 * 1000

/** Digests of the actions already handed over or retired, newest last. */
export const CONSUMED_DEEP_LINK_KEY = 'gogo.deferred_link_consumed'

/** Enough for any real sequence of installs; a bound so the list cannot grow. */
export const CONSUMED_DEEP_LINK_LIMIT = 8

type KnownAction = Exclude<DeepLinkAction, { kind: 'unknown' }>

/** One string per action, built per kind so field order can never change it. */
function canonical(action: KnownAction): string {
  switch (action.kind) {
    case 'room':
      return `room:${action.roomId}`
    case 'invite':
      return `invite:${action.inviteCode}`
    case 'plan':
      return `plan:${action.planId}`
    case 'place':
      return `place:${action.placeId}`
    case 'shareSlug':
      return `shareSlug:${action.slug}`
    case 'saved':
    case 'notifications':
    case 'profile':
      return action.kind
  }
}

/**
 * FNV-1a, 32 bit: identifies an action without keeping its slug on the device.
 * Inputs are parsed and validated, never adversarial, and at most eight are
 * kept; a collision costs one skipped resume. A keyed hash would need its key
 * stored beside the digests it protects.
 */
export function digest(action: KnownAction): string {
  const text = canonical(action)
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

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

  async function consumed(): Promise<string[]> {
    const raw = await deps.storage.get(CONSUMED_DEEP_LINK_KEY)
    if (!raw) return []
    try {
      const list: unknown = JSON.parse(raw)
      return Array.isArray(list) ? list.filter((d): d is string => typeof d === 'string') : []
    } catch {
      return []
    }
  }

  async function retire(action: KnownAction): Promise<void> {
    const list = (await consumed()).filter(d => d !== digest(action))
    list.push(digest(action))
    await deps.storage.set(CONSUMED_DEEP_LINK_KEY, JSON.stringify(list.slice(-CONSUMED_DEEP_LINK_LIMIT)))
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
      if ((await consumed()).includes(digest(action))) {
        report('deferred_link_ignored:already_consumed')
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
      // Expired or not, this report has had its turn.
      await retire(entry.action as KnownAction)
      if (now() - entry.storedAt > PENDING_DEEP_LINK_TTL_MS) {
        report('deferred_link_expired')
        return null
      }
      report(`deferred_link_resumed:${entry.action.kind}`)
      return entry.action
    },

    /**
     * For a sign-out, where another person's pending intent must not survive.
     * Retires the pending action first (see the header), and throws unless the
     * entry is really gone: a sign-out that leaves it behind must not report
     * success.
     */
    async clear(): Promise<void> {
      const entry = await read()
      if (entry) await retire(entry.action as KnownAction)
      await deps.storage.remove(PENDING_DEEP_LINK_KEY)
      if ((await deps.storage.get(PENDING_DEEP_LINK_KEY)) !== null) {
        throw new Error('pending deep link could not be cleared')
      }
    },
  }
}
