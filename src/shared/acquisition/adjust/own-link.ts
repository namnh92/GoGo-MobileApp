/**
 * GoGo-MobileApp#367 (PR #369 Sol F-02) — `parseDeepLink` reads the path and
 * ignores the host, so `https://x.go.link/l/abc123` or an Adjust tracker URL
 * with a GoGo-shaped path parses as a share link. A deferred link from Adjust
 * is only a destination when it is GoGo's own: this build's scheme, or GoGo's
 * web host for this flavour.
 */
export function createOwnLinkCheck(origin: { scheme: unknown; webBaseUrl: unknown }) {
  const scheme = typeof origin.scheme === 'string' && origin.scheme ? origin.scheme.toLowerCase() : null
  let host: string | null = null
  if (typeof origin.webBaseUrl === 'string') {
    const match = /^https:\/\/([^/?#:]+)(?::\d+)?(?:[/?#]|$)/i.exec(origin.webBaseUrl.trim())
    host = match ? match[1].toLowerCase() : null
  }
  return (url: string): boolean => {
    const trimmed = url.trim()
    const split = trimmed.indexOf('://')
    if (split <= 0) return false
    const linkScheme = trimmed.slice(0, split).toLowerCase()
    if (scheme && linkScheme === scheme) return true
    if (linkScheme !== 'https' || !host) return false
    const linkHost = /^([^/?#:@]+)(?::\d+)?(?:[/?#]|$)/.exec(trimmed.slice(split + 3))
    return linkHost !== null && linkHost[1].toLowerCase() === host
  }
}
