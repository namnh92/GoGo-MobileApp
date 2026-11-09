import type { ReactNode } from 'react'
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react-native'
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
