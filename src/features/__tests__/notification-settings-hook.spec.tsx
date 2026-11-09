import type { ReactNode } from 'react'
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react-native'

/**
 * NTF-APP-010 (#215) — the switch mutation moves optimistically, rolls back on
 * failure, keeps the server's answer on success, and touches no other query.
 */

const mockSet = jest.fn()
const mockPatch = jest.fn()
jest.mock('@/shared/api/idempotency', () => {
  let sequence = 0
  return { newIdempotencyKey: () => `settings-intent-${++sequence}` }
})
jest.mock('@/shared/api/endpoints/me', () => ({
  ...jest.requireActual('@/shared/api/endpoints/me'),
  setNotificationSettings: (...args: unknown[]) => mockSet(...args),
  patchNotificationSettings: (...args: unknown[]) => mockPatch(...args),
  getNotificationSettings: jest.fn(),
}))
import { useSetNotificationSettings } from '@/shared/api/queries/use-me'
import { shouldPersistQuery } from '@/shared/api/persist-policy'
import { queryKeys } from '@/shared/api/query-keys'
import { ApiError } from '@/shared/api/errors'
import { clearSession, getSessionGeneration, persistSession } from '@/shared/api/session'

let client: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
const inbox = { pages: [{ notifications: [{ id: 'n1', kind: 'invite' }] }] }

// GoGo-MobileApp#133: deliver TanStack's observer notifications inside the act
// that caused them; its default scheduler defers them past the act.
beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))

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


const categories = { invite: false, preference_reminder: true, plan_ready: false, plan_changed: true, date_reminder: true }
const resource = { pushEnabled: false, source: 'explicit' as const, updatedAt: null, version: '9007199254740993', categories, etag: '"opaque-etag-v12"' }

it('changes one category optimistically without enabling master; two observers share the saving lock', async () => {
  client.setQueryData(queryKeys.notificationSettings(), resource)
  let finish!: (value: unknown) => void
  mockPatch.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const { result } = await renderHook(() => [useSetNotificationSettings(), useSetNotificationSettings()], { wrapper })
  let pending!: Promise<unknown>
  await act(async () => { pending = result.current[0].mutateAsync({ categories: { invite: true } }) })
  expect(client.getQueryData(queryKeys.notificationSettings())).toMatchObject({ pushEnabled: false, categories: { ...categories, invite: true } })
  expect(result.current[1].isPending).toBe(true)
  expect(mockSet).not.toHaveBeenCalled()
  expect(mockPatch).toHaveBeenCalledWith({ categories: { invite: true } }, resource.etag, expect.any(String), getSessionGeneration())
  const stored = { ...resource, version: '9007199254740994', etag: '"opaque-etag-v13"', categories: { ...categories, invite: true } }
  await act(async () => { finish(stored); await pending })
  expect(client.getQueryData(queryKeys.notificationSettings())).toEqual(stored)
  expect(result.current[1].isPending).toBe(false)
  expect(client.getQueryData(queryKeys.notifications())).toBe(inbox)
})

it('enables the master by PATCH without resetting the five remembered choices', async () => {
  client.setQueryData(queryKeys.notificationSettings(), resource)
  mockPatch.mockResolvedValue({ ...resource, pushEnabled: true })
  const { result } = await renderHook(() => useSetNotificationSettings(), { wrapper })
  await act(async () => { await result.current.mutateAsync({ pushEnabled: true }) })
  expect(mockPatch).toHaveBeenCalledWith({ pushEnabled: true }, resource.etag, expect.any(String), getSessionGeneration())
  expect(mockSet).not.toHaveBeenCalled()
  expect(client.getQueryData(queryKeys.notificationSettings())).toMatchObject({ pushEnabled: true, categories })
})

it('enable all is one atomic category-only PATCH while the master stays off', async () => {
  client.setQueryData(queryKeys.notificationSettings(), resource)
  const all = { invite: true, preference_reminder: true, plan_ready: true, plan_changed: true, date_reminder: true }
  mockPatch.mockResolvedValue({ ...resource, categories: all })
  const { result } = await renderHook(() => useSetNotificationSettings(), { wrapper })
  await act(async () => { await result.current.mutateAsync({ categories: all }) })
  expect(mockPatch).toHaveBeenCalledTimes(1)
  expect(mockPatch.mock.calls[0][0]).toEqual({ categories: all })
  expect(client.getQueryData(queryKeys.notificationSettings())).toMatchObject({ pushEnabled: false, categories: all })
})

it('rolls back refused choices and reuses the original key and validator after an ambiguous failure', async () => {
  client.setQueryData(queryKeys.notificationSettings(), resource)
  const body = { categories: { invite: true } }
  mockPatch.mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce({ ...resource, categories: { ...categories, invite: true } })
  const { result } = await renderHook(() => useSetNotificationSettings(), { wrapper })
  await act(async () => { await result.current.mutateAsync(body).catch(() => undefined) })
  expect(client.getQueryData(queryKeys.notificationSettings())).toEqual(resource)
  // A refetch can already see a newer version after a lost successful response.
  client.setQueryData(queryKeys.notificationSettings(), { ...resource, etag: '"new-etag"' })
  await act(async () => { await result.current.mutateAsync(body) })
  expect(mockPatch.mock.calls[1]).toEqual(mockPatch.mock.calls[0])
})

it('refetches after 412, then uses a fresh validator and idempotency key for the next intent', async () => {
  client.setQueryData(queryKeys.notificationSettings(), resource)
  const body = { categories: { invite: true } }
  mockPatch.mockRejectedValueOnce(new ApiError(412, { code: 'NOTIFICATION_SETTINGS_VERSION_MISMATCH', message: 'changed' }))
    .mockResolvedValueOnce({ ...resource, categories: { ...categories, invite: true } })
  const invalidate = jest.spyOn(client, 'invalidateQueries')
  const { result } = await renderHook(() => useSetNotificationSettings(), { wrapper })
  await act(async () => { await result.current.mutateAsync(body).catch(() => undefined) })
  expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.notificationSettings(), exact: true })
  expect(client.getQueryData(queryKeys.notificationSettings())).toEqual(resource)
  client.setQueryData(queryKeys.notificationSettings(), { ...resource, etag: '"fresh-after-conflict"' })
  await act(async () => { await result.current.mutateAsync(body) })
  expect(mockPatch.mock.calls[1][1]).toBe('"fresh-after-conflict"')
  expect(mockPatch.mock.calls[1][2]).not.toBe(mockPatch.mock.calls[0][2])
})

it.each(['success', 'error'] as const)('an account A %s cannot overwrite account B settings', async outcome => {
  await persistSession({ kind: 'user', userId: 'A', accessToken: 'A', expiresAt: Date.now() + 600000 })
  client.setQueryData(queryKeys.notificationSettings(), resource)
  let finish!: (value: unknown) => void
  let fail!: (error: Error) => void
  mockPatch.mockReturnValue(new Promise((resolve, reject) => { finish = resolve; fail = reject }))
  const { result } = await renderHook(() => useSetNotificationSettings(), { wrapper })
  let pending!: Promise<unknown>
  await act(async () => { pending = result.current.mutateAsync({ categories: { invite: true } }).catch(() => undefined) })
  const second = { ...resource, etag: '"B"', pushEnabled: true }
  await act(async () => {
    await clearSession()
    await persistSession({ kind: 'user', userId: 'B', accessToken: 'B', expiresAt: Date.now() + 600000 })
    client.setQueryData(queryKeys.notificationSettings(), second)
    if (outcome === 'success') finish({ ...resource, categories: { ...categories, invite: true } })
    else fail(new Error('late A failure'))
    await pending
  })
  expect(client.getQueryData(queryKeys.notificationSettings())).toEqual(second)
  await clearSession()
})
