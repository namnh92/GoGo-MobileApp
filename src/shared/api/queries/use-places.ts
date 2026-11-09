import { firstPageRefetch } from './first-page-refetch'
import { captureSessionScope } from '../session'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'

import { getAssistantStatus } from '../endpoints/assistant'
import { isApiError } from '../errors'
import * as placesApi from '../endpoints/places'
import type { PlaceSearchQuery } from '../endpoints/places'
import { newIdempotencyKey } from '../idempotency'
import { queryKeys } from '../query-keys'
import { useIntentKey } from './use-intent-key'
import type { OpBody, ReviewOrder } from '../types'

/** Server caps `limit` at 50 regardless of what the spec's 100 suggests. */
const PAGE_SIZE = 20

/**
 * Cursor-paginated search. Filters are server-side — the app must not fetch
 * everything and filter locally, or "no results" and distance/price facts stop
 * matching what the ranking actually did.
 */
export function usePlaceSearch(query: PlaceSearchQuery, options?: { enabled?: boolean }) {
  const client = useQueryClient()
  const result = useInfiniteQuery({
    queryKey: queryKeys.placeSearch(query),
    queryFn: ({ pageParam }) =>
      countedSearch({ ...query, includeTotal: pageParam ? undefined : query.includeTotal, limit: query.limit ?? PAGE_SIZE, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    enabled: options?.enabled ?? true,
  })
  return { ...result, refetch: firstPageRefetch(client, queryKeys.placeSearch(query), result.refetch) }
}

export function usePlaceDetail(placeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.place(placeId ?? ''),
    queryFn: () => placesApi.getPlaceDetail(placeId as string),
    enabled: Boolean(placeId),
    staleTime: 0,
  })
}

/**
 * APP-056 (#212) — the latest published GoGo reviews of a place. A query of its
 * own, so a slow or failed review read never costs Place Detail its facts. A
 * short stale time: a moderator's takedown should not linger on screen.
 */
export function usePlaceReviews(placeId: string | undefined, order: ReviewOrder = 'latest') {
  return useInfiniteQuery({
    queryKey: queryKeys.placeReviews(placeId ?? '', order),
    queryFn: ({ pageParam }) => placesApi.listPlaceReviews(placeId as string, order, { limit: 10, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: Boolean(placeId),
    staleTime: 0,
    gcTime: 0,
  })
}

/**
 * Area autocomplete. The provider bills per session, so one `sessionToken`
 * covers every keystroke until a prediction is picked — `endSession()` starts
 * a fresh one.
 */
export function useAreaAutocomplete(query: string, options?: { enabled?: boolean }) {
  const sessionToken = useRef<string>(newIdempotencyKey())

  const endSession = useCallback(() => {
    sessionToken.current = newIdempotencyKey()
  }, [])

  const trimmed = query.trim()
  const result = useQuery({
    queryKey: queryKeys.areas(trimmed),
    queryFn: () => placesApi.suggestAreas({ query: trimmed, sessionToken: sessionToken.current }),
    // The endpoint requires a non-empty query; a blank box shows the fallback list.
    enabled: (options?.enabled ?? true) && trimmed.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  return { ...result, endSession }
}

/** Resolves a pasted Google Maps link to a preview — creates nothing. */
export function useResolveGoogleMapsLink() {
  return useMutation({
    mutationFn: (body: OpBody<'resolveGoogleMapsLink'>) => placesApi.resolveGoogleMapsLink(body),
  })
}

export function useSubmitPlaceImport() {
  return useMutation({
    mutationFn: (body: OpBody<'submitPlaceImport'>) => placesApi.submitPlaceImport(body),
  })
}

/**
 * Verification runs asynchronously, so the import is polled until it leaves
 * `pending`. Stops polling on a terminal status.
 */
export function usePlaceImportStatus(importId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.placeImport(importId ?? ''),
    queryFn: () => placesApi.getPlaceImport(importId as string),
    enabled: Boolean(importId),
    refetchInterval: q => (q.state.data?.status === 'pending' ? 2000 : false),
  })
}

export function useSubmitPlace() {
  return useMutation({
    mutationFn: (body: OpBody<'submitPlace'>) => placesApi.submitPlace(body),
  })
}

/** Polled while pending — a moderator decides, so the answer arrives later. */
export function usePlaceSubmission(id: string | undefined) {
  const client = useQueryClient()
  return useQuery({
    queryKey: queryKeys.placeSubmission(id ?? ''),
    queryFn: async () => {
      const scope = captureSessionScope()
      const submission = await placesApi.getPlaceSubmission(id as string)
      scope.assert()
      if (submission.status === 'approved') await client.invalidateQueries({ queryKey: ['assistant'] })
      return submission
    },
    enabled: Boolean(id),
    refetchInterval: query => (isApiError(query.state.error) && query.state.error.status === 403 ? false : query.state.data?.status === 'pending' ? 10_000 : false),
  })
}


/** A count outage must not take discovery down. A fallback never invents a count. */
async function countedSearch(query: PlaceSearchQuery) {
  try { return await placesApi.searchPlaces(query) }
  catch (error) {
    if (query.includeTotal && isApiError(error) && error.code === 'SEARCH_COUNT_UNAVAILABLE') {
      return placesApi.searchPlaces({ ...query, includeTotal: undefined })
    }
    throw error
  }
}

/** Each complete scope/query/draft is its own cache entry; older replies cannot replace it. */
export function useDiscoveryPreview(query: PlaceSearchQuery, enabled: boolean) {
  return useQuery({
    queryKey: ['places', 'discovery-preview', query],
    queryFn: () => countedSearch({ ...query, includeTotal: true, limit: 1 }),
    enabled,
    retry: false,
  })
}

/** Always HTTP: a development assistant fixture cannot promise a real approval award. */
export function useContributionCredits(enabled: boolean) {
  return useQuery({
    queryKey: ['assistant', 'contribution-credits'],
    queryFn: getAssistantStatus,
    enabled,
    staleTime: 0,
  })
}

export function usePlaceProviderPhotos(placeId: string | undefined) {
  return useQuery({
    queryKey: ['place-provider-photos', placeId],
    queryFn: () => placesApi.getPlaceProviderPhotos(placeId as string),
    enabled: Boolean(placeId),
    gcTime: Infinity,
    staleTime: Infinity,
    retry: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
}

export function useReportPlace(placeId: string) {
  const intent = useIntentKey()
  return useMutation({
    mutationFn: (body: OpBody<'reportPlace'>) => placesApi.reportPlace(placeId, body, intent.keyFor(body)),
    onSettled: (_data, _error, body) => intent.release(body),
  })
}
