import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyCredits, getMyCreditLedger } from '../endpoints/credits'
import { queryKeys } from '../query-keys'
import { captureSessionScope, getSession, getSessionGeneration } from '../session'
import { firstPageRefetch } from './first-page-refetch'

function useCreditScope(enabled: boolean) {
  const session = getSession()
  return { userId: session?.userId ?? '', generation: getSessionGeneration(), enabled: enabled && session?.kind === 'user' }
}

/** Call only with the current GET /me capability explicitly true. No disk persistence. */
export function useMyCredits(enabled: boolean) {
  const scope = useCreditScope(enabled)
  return useQuery({
    queryKey: queryKeys.creditSummary(scope.userId, scope.generation),
    queryFn: ({ signal }) => captureSessionScope(scope.generation).wait(getMyCredits(signal)),
    enabled: scope.enabled,
    staleTime: 0,
    retry: false,
  })
}

export function useMyCreditLedger(enabled: boolean) {
  const scope = useCreditScope(enabled)
  const client = useQueryClient()
  const key = queryKeys.creditLedger(scope.userId, scope.generation)
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) => captureSessionScope(scope.generation).wait(getMyCreditLedger(pageParam, signal)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: scope.enabled,
    staleTime: 0,
    retry: false,
  })
  const refresh = firstPageRefetch(client, key, query.refetch)
  return { ...query, refresh: async () => {
    const lifetime = captureSessionScope(scope.generation)
    lifetime.assert()
    return lifetime.wait(refresh())
  } }
}
