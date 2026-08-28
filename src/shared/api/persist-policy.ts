/**
 * Offline cache for the active date: the current plan and the place summaries
 * it references must stay readable with a flaky connection. Only those keys are
 * persisted — search results and suggestion runs are deliberately not.
 *
 * Kept free of React Native imports so the policy can be tested on its own; the
 * persister that uses it lives in `query-client.ts`.
 */
const PERSISTED_PREFIXES: readonly string[] = ['rooms', 'plans', 'places', 'me']

/**
 * List keys put their discriminator right after the root — `['places',
 * 'search', query]`, not `['places', 'list', 'search', query]`. Reading the
 * wrong position silently persisted every search result; the device cache is
 * what caught it, so the check now scans the string segments instead of
 * trusting one index.
 */
const EXCLUDED_SEGMENTS: readonly string[] = ['search']

export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const [root] = queryKey
  if (typeof root !== 'string' || !PERSISTED_PREFIXES.includes(root)) return false
  return !queryKey.some(
    segment => typeof segment === 'string' && EXCLUDED_SEGMENTS.includes(segment),
  )
}
