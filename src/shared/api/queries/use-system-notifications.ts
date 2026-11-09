import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { listSystemNotifications } from '../system-notifications'

const MAX_AUTO_PAGES = 5

export function useSystemNotificationsQuery({ loadAll = false }: { loadAll?: boolean } = {}) {
  const query = useInfiniteQuery({
    queryKey: ['system-notifications'],
    queryFn: ({ pageParam, signal }) => listSystemNotifications(pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
    staleTime: 60_000,
  })
  const loadingAll = loadAll && !!query.hasNextPage && (query.data?.pages.length ?? 0) < MAX_AUTO_PAGES
    && !query.isError && !query.isPaused
  const { isFetching, fetchNextPage } = query
  useEffect(() => {
    if (loadingAll && !isFetching) void fetchNextPage({ cancelRefetch: false }).catch(() => undefined)
  }, [loadingAll, isFetching, fetchNextPage, query.data])
  return { ...query, loadingAll, status: query.data?.pages[0]?.status ?? query.status }
}
