import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query'

/** A manual refresh starts a new cursor chain, keeping page one visible while
 * it loads. Cancel a pending load-more before removing its stale cursor. */
export function firstPageRefetch<TArgs extends unknown[], TResult>(
  client: QueryClient, queryKey: QueryKey, refetch: (...args: TArgs) => Promise<TResult>,
) {
  return async (...args: TArgs): Promise<TResult> => {
    await client.cancelQueries({ queryKey, exact: true })
    client.setQueryData<InfiniteData<unknown>>(queryKey, data => data ? {
      ...data, pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1),
    } : data)
    return refetch(...args)
  }
}
