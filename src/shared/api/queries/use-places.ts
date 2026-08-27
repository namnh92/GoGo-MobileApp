import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'

import * as placesApi from '../endpoints/places'
import type { PlaceSearchQuery } from '../endpoints/places'
import { newIdempotencyKey } from '../idempotency'
import { queryKeys } from '../query-keys'
import type { OpBody } from '../types'

/** Server caps `limit` at 50 regardless of what the spec's 100 suggests. */
const PAGE_SIZE = 20

/**
 * Cursor-paginated search. Filters are server-side — the app must not fetch
 * everything and filter locally, or "no results" and distance/price facts stop
 * matching what the ranking actually did.
 */
export function usePlaceSearch(query: PlaceSearchQuery, options?: { enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: queryKeys.placeSearch(query),
    queryFn: ({ pageParam }) =>
      placesApi.searchPlaces({ ...query, limit: query.limit ?? PAGE_SIZE, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    enabled: options?.enabled ?? true,
  })
}

export function usePlaceDetail(placeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.place(placeId ?? ''),
    queryFn: () => placesApi.getPlaceDetail(placeId as string),
    enabled: Boolean(placeId),
    staleTime: 5 * 60 * 1000,
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

export function usePlaceSubmission(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.placeSubmission(id ?? ''),
    queryFn: () => placesApi.getPlaceSubmission(id as string),
    enabled: Boolean(id),
  })
}
