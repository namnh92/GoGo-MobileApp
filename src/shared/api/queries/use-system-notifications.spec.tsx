import type { ReactNode } from 'react'
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import { useSystemNotificationsQuery } from './use-system-notifications'

const mockList = jest.fn()
jest.mock('../system-notifications', () => ({ listSystemNotifications: (...args: unknown[]) => mockList(...args) }))
let client: QueryClient
function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider> }
beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))
beforeEach(() => { jest.clearAllMocks(); client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }) })
afterEach(() => client.clear())
it('probes capability, deduplicates consumers and follows public cursors', async () => {
  mockList.mockResolvedValueOnce({ status: 'supported', items: [{ id: 'first' }], nextCursor: 'opaque+next/==' })
    .mockResolvedValueOnce({ status: 'supported', items: [{ id: 'second' }], nextCursor: null })
  const { result } = await renderHook(() => { const inbox = useSystemNotificationsQuery(); useSystemNotificationsQuery(); return inbox }, { wrapper })
  expect(result.current.status).toBe('supported')
  expect(mockList).toHaveBeenCalledTimes(1)
  await act(async () => { await result.current.fetchNextPage() })
  expect(mockList.mock.calls[1]).toEqual(['opaque+next/==', expect.any(AbortSignal)])
  expect(result.current.data?.pages.flatMap(page => page.items)).toEqual([{ id: 'first' }, { id: 'second' }])
  expect(result.current.hasNextPage).toBe(false)
})
it('404 capability ends pagination and a later refetch can discover the deployed endpoint', async () => {
  mockList.mockResolvedValueOnce({ status: 'unsupported', items: [], nextCursor: null })
  const { result } = await renderHook(useSystemNotificationsQuery, { wrapper })
  expect(result.current.status).toBe('unsupported')
  expect(result.current.hasNextPage).toBe(false)
  mockList.mockResolvedValueOnce({ status: 'supported', items: [], nextCursor: null })
  await act(async () => { await result.current.refetch() })
  expect(result.current.status).toBe('supported')
})
it('does not reinterpret a network failure as unsupported', async () => {
  mockList.mockRejectedValue(new Error('offline'))
  const { result } = await renderHook(useSystemNotificationsQuery, { wrapper })
  expect(result.current.status).toBe('error')
  expect(result.current.isError).toBe(true)
})
it('automatically follows all public pages for a signed-in feed and deduplicates consumers', async () => {
  mockList.mockImplementation(async (cursor?: string) => ({
    status: 'supported', items: [{ id: cursor ?? 'first' }], nextCursor: cursor ? null : 'opaque+next/==',
  }))
  const { result } = await renderHook(() => {
    const inbox = useSystemNotificationsQuery({ loadAll: true })
    useSystemNotificationsQuery({ loadAll: true })
    return inbox
  }, { wrapper })
  await waitFor(() => expect(result.current.data?.pages).toHaveLength(2))
  expect(result.current.loadingAll).toBe(false)
  expect(mockList).toHaveBeenCalledTimes(2)
  expect(mockList.mock.calls[1]).toEqual(['opaque+next/==', expect.any(AbortSignal)])
})
it('bounds automatic loading to five pages even when the server keeps offering cursors', async () => {
  mockList.mockImplementation(async (cursor?: string) => ({
    status: 'supported', items: [], nextCursor: String(Number(cursor ?? 0) + 1),
  }))
  const { result, rerender } = await renderHook(() => useSystemNotificationsQuery({ loadAll: true }), { wrapper })
  await waitFor(() => expect(result.current.loadingAll).toBe(false))
  expect(result.current.data?.pages).toHaveLength(5)
  expect(result.current.hasNextPage).toBe(true)
  await rerender({})
  expect(mockList).toHaveBeenCalledTimes(5)
})
it('retains manual pagination when signed out and auto-loads the tail on sign-in', async () => {
  mockList.mockResolvedValueOnce({ status: 'supported', items: [{ id: 'first' }], nextCursor: 'next' })
    .mockResolvedValueOnce({ status: 'supported', items: [{ id: 'second' }], nextCursor: null })
  const { result, rerender } = await renderHook(({ loadAll }: { loadAll: boolean }) => useSystemNotificationsQuery({ loadAll }), { wrapper, initialProps: { loadAll: false } })
  expect(mockList).toHaveBeenCalledTimes(1)
  expect(result.current.hasNextPage).toBe(true)
  await rerender({ loadAll: true })
  await waitFor(() => expect(result.current.data?.pages).toHaveLength(2))
})
it('stops after a failed public page, preserves rows and allows retry to finish loading', async () => {
  mockList.mockResolvedValueOnce({ status: 'supported', items: [{ id: 'first' }], nextCursor: 'next' })
    .mockRejectedValueOnce(new Error('503'))
  const { result } = await renderHook(() => useSystemNotificationsQuery({ loadAll: true }), { wrapper })
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(mockList).toHaveBeenCalledTimes(2)
  expect(result.current.data?.pages).toHaveLength(1)
  expect(result.current.loadingAll).toBe(false)
  mockList.mockResolvedValueOnce({ status: 'supported', items: [{ id: 'first' }], nextCursor: 'next' })
    .mockResolvedValueOnce({ status: 'supported', items: [{ id: 'second' }], nextCursor: null })
  await act(async () => { await result.current.refetch() })
  await waitFor(() => expect(result.current.data?.pages).toHaveLength(2))
  expect(result.current.isError).toBe(false)
})
