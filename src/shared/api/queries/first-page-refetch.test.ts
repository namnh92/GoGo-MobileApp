import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import { firstPageRefetch } from './first-page-refetch'

it('refreshes only page one after load more, then follows the new cursor', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  let cursor = 'old'
  const request = vi.fn(async ({ pageParam }: { pageParam: string | undefined }) => ({
    items: [pageParam ?? 'first'], nextCursor: pageParam ? undefined : cursor,
  }))
  const observer = new InfiniteQueryObserver(client, {
    queryKey: ['list'], queryFn: request, initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor,
  })
  const unsubscribe = observer.subscribe(() => {})
  try {
    await observer.refetch()
    await observer.fetchNextPage()
    expect(observer.getCurrentResult().data?.pageParams).toEqual([undefined, 'old'])
    cursor = 'new'
    request.mockClear()
    await firstPageRefetch(client, ['list'], () => observer.refetch())()
    expect(request.mock.calls.map(([args]) => args.pageParam)).toEqual([undefined])
    expect(observer.getCurrentResult().data?.pageParams).toEqual([undefined])
    await observer.fetchNextPage()
    expect(request.mock.calls.map(([args]) => args.pageParam)).toEqual([undefined, 'new'])
  } finally { unsubscribe(); client.clear() }
})

it('cancels a pending next page before resetting its cursor and keeps cached page one on failure', async () => {
  const client = new QueryClient()
  const key = ['list']
  client.setQueryData(key, { pages: ['first', 'second'], pageParams: [undefined, 'old'] })
  let aborted = false
  const pending = client.fetchQuery({ queryKey: key, queryFn: ({ signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')) })
  }) }).catch(() => undefined)
  const refetch = vi.fn(async () => { throw new Error('offline') })
  await expect(firstPageRefetch(client, key, refetch)()).rejects.toThrow('offline')
  await pending
  expect(aborted).toBe(true)
  expect(refetch).toHaveBeenCalledTimes(1)
  expect(client.getQueryData(key)).toEqual({ pages: ['first'], pageParams: [undefined] })
  client.clear()
})
