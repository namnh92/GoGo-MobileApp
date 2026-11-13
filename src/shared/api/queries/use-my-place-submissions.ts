import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getMyPlaceSubmission, isSubmissionDetailRetryable, listMyPlaceSubmissions, type MyPlaceSubmission } from '../endpoints/my-place-submissions'

/** Mounted private cards only: no polling, disk persistence or retries on rate limits.
 * Keep a per-ID memory cache across filters; a new decision gets a new key.
 * Budget/deferred outcomes stay fresh until this private memory cache is evicted.
 */
export function useMyPlaceSubmission(item: Pick<MyPlaceSubmission, 'id'> & Partial<Pick<MyPlaceSubmission, 'updatedAt'>>, enabled: boolean) {
  return useQuery({
    queryKey: ['my-place-submissions', item.id, 'detail', item.updatedAt],
    queryFn: ({ signal }) => getMyPlaceSubmission(item.id, signal),
    enabled,
    staleTime: query => ['budget_exhausted', 'deferred'].includes(query.state.data?.providerStatus ?? '') ? Infinity : 60_000,
    gcTime: 5 * 60_000,
    retry: (count, error) => count < 1 && isSubmissionDetailRetryable(error),
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
