import { z } from 'zod'

/**
 * One parser for every link source.
 *
 * Links reach the app from four places — a universal/app link, the `gogo://`
 * scheme, a push payload, and (later) a deferred link recovered after install.
 * Each of those used to imply its own navigation branch, which is how the same
 * invite ends up working from Safari and silently failing from a notification.
 * They all normalise here instead, and nothing navigates on a shape this file
 * has not validated.
 */

/** Every id the contract hands out is a UUID; anything else is not ours. */
const uuid = z.string().uuid()

/**
 * Invite codes are high-entropy, expiring and carry no PII, so the only thing
 * worth asserting is the alphabet and a sane length — the server is the
 * authority on whether a code is live.
 */
const inviteCode = z.string().regex(/^[A-Za-z0-9_-]{6,64}$/)

/** Share-link slugs are short opaque tokens minted by the BFF. */
const shareSlug = z.string().regex(/^[A-Za-z0-9_-]{4,32}$/)

export type DeepLinkAction =
  | { kind: 'room'; roomId: string }
  | { kind: 'invite'; inviteCode: string }
  | { kind: 'plan'; planId: string }
  | { kind: 'place'; placeId: string }
  | { kind: 'saved' }
  | { kind: 'notifications' }
  | { kind: 'profile' }
  /**
   * Canonical share link. The slug names a target but does not reveal it, so the
   * resolve happens on `/l/[slug]` against the BFF rather than here — this
   * parser stays synchronous and free of network.
   */
  | { kind: 'shareSlug'; slug: string }
  | { kind: 'unknown'; reason: 'empty' | 'unparseable' | 'unsupported' | 'invalid-params' }

/**
 * Splits a URL without `new URL()`, which Hermes implements only partially and
 * which throws on a custom scheme like `gogo-dev://room/123` on some engines.
 */
function segmentsOf(url: string): string[] | null {
  const trimmed = url.trim()
  if (!trimmed) return null

  const schemeSplit = trimmed.indexOf('://')
  if (schemeSplit === -1) return null

  const afterScheme = trimmed.slice(schemeSplit + 3)
  const scheme = trimmed.slice(0, schemeSplit).toLowerCase()

  // Strip query and fragment; deep links carry their payload in the path.
  const pathOnly = afterScheme.split(/[?#]/)[0]

  // For https the first segment is the host and is not part of the path. For a
  // custom scheme `gogo://room/1` the "host" IS the first path segment, which is
  // the classic reason scheme links break while universal links work.
  const raw = pathOnly.split('/').filter(Boolean)
  const isWeb = scheme === 'http' || scheme === 'https'
  const segments = isWeb ? raw.slice(1) : raw

  return segments.map(s => {
    try {
      return decodeURIComponent(s)
    } catch {
      return s
    }
  })
}

/**
 * A link is only ever as trustworthy as its worst source, so an unrecognised or
 * malformed one resolves to `unknown` and the caller sends the user somewhere
 * safe — never a crash, never a half-built screen.
 */
export function parseDeepLink(url: string | null | undefined): DeepLinkAction {
  if (!url || !url.trim()) return { kind: 'unknown', reason: 'empty' }

  const segments = segmentsOf(url)
  if (!segments) return { kind: 'unknown', reason: 'unparseable' }
  if (segments.length === 0) return { kind: 'unknown', reason: 'empty' }

  const [head, param] = segments

  switch (head) {
    case 'room':
    case 'rooms': {
      const parsed = uuid.safeParse(param)
      return parsed.success ? { kind: 'room', roomId: parsed.data } : { kind: 'unknown', reason: 'invalid-params' }
    }
    // `/r/{code}` is the shape printed on invites; `invite/` is the internal name.
    case 'r':
    case 'invite': {
      const parsed = inviteCode.safeParse(param)
      return parsed.success ? { kind: 'invite', inviteCode: parsed.data } : { kind: 'unknown', reason: 'invalid-params' }
    }
    case 'plan':
    case 'plans': {
      const parsed = uuid.safeParse(param)
      return parsed.success ? { kind: 'plan', planId: parsed.data } : { kind: 'unknown', reason: 'invalid-params' }
    }
    case 'place':
    case 'places': {
      const parsed = uuid.safeParse(param)
      return parsed.success ? { kind: 'place', placeId: parsed.data } : { kind: 'unknown', reason: 'invalid-params' }
    }
    case 'l': {
      const parsed = shareSlug.safeParse(param)
      return parsed.success ? { kind: 'shareSlug', slug: parsed.data } : { kind: 'unknown', reason: 'invalid-params' }
    }
    case 'saved':
      return { kind: 'saved' }
    case 'notifications':
      return { kind: 'notifications' }
    case 'profile':
      return { kind: 'profile' }
    default:
      return { kind: 'unknown', reason: 'unsupported' }
  }
}

/**
 * The in-app route for an action. Kept apart from the parser so the mapping can
 * be asserted without a navigator, and so push and link sources cannot drift
 * onto different destinations for the same resource.
 */
export function routeForAction(action: DeepLinkAction): string {
  switch (action.kind) {
    case 'room':
      return `/room/${action.roomId}`
    case 'invite':
      return `/r/${action.inviteCode}`
    case 'plan':
      return `/plans/${action.planId}`
    case 'place':
      return `/places/${action.placeId}`
    case 'saved':
      return '/(tabs)/saved'
    case 'notifications':
      return '/notifications'
    case 'profile':
      return '/(tabs)/profile'
    // `/l/[slug]` resolves the slug through the BFF and replaces itself with the
    // real destination. Sending the person home instead — which is what this did
    // while `GET /share-links/{slug}` was still open work — loses the thing they
    // were invited to without saying so.
    case 'shareSlug':
      return `/l/${action.slug}`
    case 'unknown':
      return '/(tabs)'
  }
}

/** Convenience for callers that only need "where do I send them". */
export function routeForLink(url: string | null | undefined): string {
  return routeForAction(parseDeepLink(url))
}
