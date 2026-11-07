import { queryOptions, type QueryClient } from '@tanstack/react-query'

import { conditionalGet } from './client'
import { queryKeys } from './query-keys'
import type { TaxonomyList } from './types'

export type CachedTaxonomies = { data: TaxonomyList; etag: string | null }

// Process-local validation state deliberately does not survive hydration. Each
// locale revalidates once on launch, regardless of how many screens consume it.
const validated = new WeakMap<QueryClient, { locales: Set<string>; version: number }>()

export function taxonomyOptions(client: QueryClient, locale: string) {
  let validation = validated.get(client)
  if (!validation) {
    // Hydration can already contain a newer generation in another locale.
    const versions = client.getQueriesData<CachedTaxonomies>({ queryKey: ['taxonomies'] })
      .map(([, cached]) => cached?.data.version ?? 0)
    validation = { locales: new Set(), version: Math.max(0, ...versions) }
    validated.set(client, validation)
  }
  const state = validation
  const checked = state.locales
  function markValidated(version = 0) {
    // Options may have been created before asynchronous hydration completed.
    const knownVersion = Math.max(version, ...client.getQueriesData<CachedTaxonomies>({ queryKey: ['taxonomies'] })
      .map(([, cached]) => cached?.data.version ?? 0))
    if (knownVersion > state.version) {
      state.version = knownVersion
      checked.clear()
      // Preserve other locales as offline fallbacks; revalidate on next use.
      void client.invalidateQueries({
        predicate: query => query.queryKey[0] === 'taxonomies' && query.queryKey[1] !== locale,
        refetchType: 'none',
      })
    }
    // An offline fallback (or an older in-flight response) cannot validate a
    // locale against a newer generation we already know about.
    if (version === state.version) checked.add(locale)
    else checked.delete(locale)
  }
  const queryKey = queryKeys.taxonomies(locale)
  return queryOptions({
    queryKey,
    staleTime: () => checked.has(locale) ? Infinity : 0,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: () => !checked.has(locale),
    queryFn: async ({ signal }): Promise<CachedTaxonomies> => {
      const cached = client.getQueryData<CachedTaxonomies>(queryKey)
      try {
        const result = await conditionalGet<TaxonomyList>('/taxonomies', {
          query: { locale }, ifNoneMatch: cached?.etag ?? undefined, signal,
        })
        if (result.status === 304) {
          if (!cached) throw new Error('Taxonomy 304 without a cached representation')
          markValidated(cached.data.version)
          return { ...cached, etag: result.etag ?? cached.etag }
        }
        // Keep a version-addressed snapshot as well as the current locale pointer.
        // Kind filters are projections of this single complete representation.
        const next = cached && cached.data.version !== undefined && cached.data.version === result.data.version ? cached.data : result.data
        const snapshot = { data: next, etag: result.etag }
        if (next.version !== undefined) client.setQueryData(queryKeys.taxonomyVersion(locale, next.version), snapshot)
        client.removeQueries({ predicate: q => q.queryKey[0] === 'taxonomies'
          && q.queryKey[1] === locale && typeof q.queryKey[2] === 'number'
          && q.queryKey[2] !== next.version })
        markValidated(next.version)
        return snapshot
      } catch (error) {
        if (signal.aborted || !cached) throw error
        // A failed launch revalidation must not turn populated pickers into an
        // error screen or evict their persisted labels.
        markValidated(cached.data.version)
        return cached
      }
    },
  })
}

export function selectTaxonomies(cached: CachedTaxonomies, kinds?: string): TaxonomyList {
  if (!kinds) return cached.data
  const selected = new Set(kinds.split(',').map(kind => kind.trim()).filter(Boolean))
  return { ...cached.data, kinds: Object.fromEntries(
    Object.entries(cached.data.kinds ?? {}).filter(([kind]) => selected.has(kind)),
  ) }
}
