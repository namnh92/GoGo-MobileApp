import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getMyPlaceSubmission, listMyPlaceSubmissions, type MyPlaceSubmission } from '../endpoints/my-place-submissions'
import { isApiError, isRetryable } from '../errors'

/** Mounted private cards only: no polling, disk persistence or retries on rate limits.
 * Keep a short per-ID memory cache across filters; a new decision gets a new key.
 */
export function useMyPlaceSubmission(item: MyPlaceSubmission, enabled: boolean) {
  return useQuery({
    queryKey: ['my-place-submissions', item.id, 'detail', item.updatedAt],
    queryFn: ({ signal }) => getMyPlaceSubmission(item.id, signal),
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: (count, error) => count < 1 && isRetryable(error) && !(isApiError(error) && error.status === 429),
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

/** Authenticated and memory-only. The backend does not support status filtering. */
export function useMyPlaceSubmissions(enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['my-place-submissions'],
    queryFn: ({ pageParam }) => listMyPlaceSubmissions(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
}
