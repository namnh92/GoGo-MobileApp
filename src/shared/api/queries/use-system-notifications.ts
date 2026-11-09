import { useInfiniteQuery } from '@tanstack/react-query'
import { listSystemNotifications } from '../system-notifications'

export function useSystemNotificationsQuery() {
  const query = useInfiniteQuery({
    queryKey: ['system-notifications'],
    queryFn: ({ pageParam, signal }) => listSystemNotifications(pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
    staleTime: 60_000,
  })
  return { ...query, status: query.data?.pages[0]?.status ?? query.status }
}
