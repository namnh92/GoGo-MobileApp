import type { Persister } from '@tanstack/react-query-persist-client'

/**
 * Offline cache for the active date: the current plan and separately cached
 * minimal place summaries stay readable with a flaky connection. Profile and public
 * reference datasets (administrative units and taxonomies) persist too. Full
 * PlaceDetail is excluded: it contains moderated aggregates and provider facts.
 * Search results, suggestion runs, review pages and transient provider bytes
 * never persist.
 *
 * Kept free of React Native imports so the policy can be tested on its own; the
 * persister that uses it lives in `query-client.ts`.
 */
const PERSISTED_PREFIXES: readonly string[] = ['rooms', 'plans', 'places', 'me', 'administrative', 'taxonomies']

/**
 * List keys put their discriminator right after the root — `['places',
 * 'search', query]`, not `['places', 'list', 'search', query]`. Reading the
 * wrong position silently persisted every search result; the device cache is
 * what caught it, so the check now scans the string segments instead of
 * trusting one index.
 *
 * `public-reviews` (APP-056) is a place's moderated review preview. It is not
 * what an active date needs offline, and a review a moderator hid must not
 * come back from disk on the next cold start. `review-reactions` (APP-060) is
 * the caller's own helpful marks, which follow the same reviews.
 */
const EXCLUDED_SEGMENTS: readonly string[] = ['search', 'detail', 'public-reviews', 'review-reactions', 'notification-summary']

/** Public in-memory snapshots survive logout; disk persistence is a separate policy. */
export function isPublicAppQuery(queryKey: readonly unknown[]): boolean {
  const [root, id, kind] = queryKey
  if (root === 'system-notifications') return queryKey.length === 1
  if (root === 'administrative' || root === 'taxonomies') return true
  if (typeof id !== 'string' || !id) return false
  if (root === 'place-provider-photos' || root === 'candidate-provider-photo') return queryKey.length === 2
  return root === 'places' && id !== 'imports' && queryKey.length === 3 && (kind === 'detail' || kind === 'plan-summary')
}

export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const [root] = queryKey
  if (typeof root !== 'string' || !PERSISTED_PREFIXES.includes(root)) return false
  return !queryKey.some(
    segment => typeof segment === 'string' && EXCLUDED_SEGMENTS.includes(segment),
  )
}

/** Public taxonomy generations outlive the 24-hour account-data cache. */
export function retainTaxonomies(persister: Persister): Persister {
  return {
    persistClient: client => persister.persistClient(client),
    removeClient: () => persister.removeClient(),
    restoreClient: async () => {
      const restored = await persister.restoreClient()
      if (!restored) return restored
      // A process restart ends the lifetime that owned every paused intent.
      const saved = { ...restored, clientState: { ...restored.clientState, mutations: [] } }
      if (!saved || Date.now() - saved.timestamp <= 24 * 60 * 60 * 1000) return saved
      // Keep the original timestamp and buster: the provider still checks the
      // cache format, while only public taxonomy data is exempt from expiry.
      return {
        ...saved,
        clientState: {
          mutations: [],
          queries: saved.clientState.queries.filter(query => query.queryKey[0] === 'taxonomies'),
        },
      }
    },
  }
}
