import { useInfiniteQuery } from '@tanstack/react-query'
import { listMyPlaceSubmissions } from '../endpoints/my-place-submissions'

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
