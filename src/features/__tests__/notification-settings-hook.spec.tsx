import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react-native'

/**
 * NTF-APP-010 (#215) — the switch mutation moves optimistically, rolls back on
 * failure, keeps the server's answer on success, and touches no other query.
 */

const mockSet = jest.fn()
jest.mock('@/shared/api/endpoints/me', () => ({
  ...jest.requireActual('@/shared/api/endpoints/me'),
  setNotificationSettings: (...args: unknown[]) => mockSet(...args),
  getNotificationSettings: jest.fn(),
}))
import { useSetNotificationSettings } from '@/shared/api/queries/use-me'
import { shouldPersistQuery } from '@/shared/api/persist-policy'
import { queryKeys } from '@/shared/api/query-keys'

let client: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
const inbox = { pages: [{ notifications: [{ id: 'n1', kind: 'invite' }] }] }

beforeEach(() => {
  // gcTime Infinity: a mutation schedules a 5-minute garbage-collection timer
  // when its observer unmounts, and `client.clear()` does not cancel it, so a
  // finite gcTime leaves a live timer that keeps the Jest worker running.
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity }, queries: { retry: false, gcTime: Infinity } },
  })
  client.setQueryData(queryKeys.notificationSettings(), { pushEnabled: true, source: 'default', updatedAt: null })
  client.setQueryData(queryKeys.notifications(), inbox)
  jest.clearAllMocks()
})
afterEach(() => client.clear())

it('restores the previous value when the save fails, and leaves the inbox alone', async () => {
  let reject!: (error: Error) => void
  mockSet.mockReturnValue(new Promise((_resolve, fail) => { reject = fail }))
  const invalidate = jest.spyOn(client, 'invalidateQueries')
  const { result } = await renderHook(() => useSetNotificationSettings(), { wrapper })

  let pending!: Promise<unknown>
  await act(async () => {
    pending = result.current.mutateAsync({ pushEnabled: false }).catch(() => undefined)
  })
  // Moved on tap…
  expect(client.getQueryData(queryKeys.notificationSettings())).toMatchObject({ pushEnabled: false })
  // …and back when the server refused.
  await act(async () => {
    reject(new Error('offline'))
    await pending
  })
  expect(client.getQueryData(queryKeys.notificationSettings())).toMatchObject({ pushEnabled: true })

  expect(client.getQueryData(queryKeys.notifications())).toBe(inbox)
  for (const [filters] of invalidate.mock.calls) {
    expect(filters).toMatchObject({ queryKey: queryKeys.notificationSettings(), exact: true })
  }
})

it('keeps what the server stored', async () => {
  const stored = { pushEnabled: false, source: 'explicit', updatedAt: '2026-09-14T01:02:03Z' }
  mockSet.mockResolvedValue(stored)
  const { result } = await renderHook(() => useSetNotificationSettings(), { wrapper })
  await act(async () => {
    await result.current.mutateAsync({ pushEnabled: false })
  })
  expect(mockSet).toHaveBeenCalledTimes(1)
  expect(mockSet).toHaveBeenCalledWith({ pushEnabled: false })
  expect(client.getQueryData(queryKeys.notificationSettings())).toEqual(stored)
})

it('lives under the account prefix that sign-in and sign-out purge', () => {
  expect(queryKeys.notificationSettings()[0]).toBe('me')
  expect(shouldPersistQuery(queryKeys.notificationSettings())).toBe(true)
})
