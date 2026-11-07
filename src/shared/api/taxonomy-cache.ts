import { queryOptions, type QueryClient } from '@tanstack/react-query'

import { conditionalGet } from './client'
import { queryKeys } from './query-keys'
import type { TaxonomyList } from './types'

export type CachedTaxonomies = { data: TaxonomyList; etag: string | null }

// Process-local validation state deliberately does not survive hydration. Each
// locale revalidates once on launch, regardless of how many screens consume it.
const validated = new WeakMap<QueryClient, Set<string>>()

export function taxonomyOptions(client: QueryClient, locale: string) {
  let locales = validated.get(client)
  if (!locales) validated.set(client, locales = new Set())
  const checked = locales
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
          checked.add(locale)
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
        checked.add(locale)
        return snapshot
      } catch (error) {
        if (signal.aborted || !cached) throw error
        // A failed launch revalidation must not turn populated pickers into an
        // error screen or evict their persisted labels.
        checked.add(locale)
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
