import type { ReactNode } from 'react'
import { notifyManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react-native'

const mockSummary = jest.fn()
const mockList = jest.fn()
const mockRead = jest.fn()
const mockReadAll = jest.fn()
const mockPoll = jest.fn()
jest.mock('@/shared/api/endpoints/me', () => ({
  ...jest.requireActual('@/shared/api/endpoints/me'),
  getNotificationSummary: (...args: unknown[]) => mockSummary(...args),
  listNotifications: (...args: unknown[]) => mockList(...args),
  markNotificationRead: (...args: unknown[]) => mockRead(...args),
  readAllNotifications: (...args: unknown[]) => mockReadAll(...args),
  getNotificationReadOperation: (...args: unknown[]) => mockPoll(...args),
}))
import { useMarkNotificationRead, useNotificationSummary, useNotifications, useReadAllNotifications } from '@/shared/api/queries/use-me'
import { queryKeys } from '@/shared/api/query-keys'
import { bindSessionCaches } from '@/shared/api/session-query-cache'
import { clearSession, persistSession, SessionCancelledError } from '@/shared/api/session'
import { shouldPersistQuery } from '@/shared/api/persist-policy'
import { generatedNotificationCapabilities } from '@/features/notifications/notification-capabilities'

let client: QueryClient
const snapshot = { unreadCount: 701, asOf: '2026-11-08T12:00:00Z', readThroughCursor: 'signed-account-cutoff' }
const completed = { operationId: 'op-1', status: 'completed', asOf: snapshot.asOf, changedCount: 701 }
const running = { ...completed, status: 'running', changedCount: 500 }
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
function useInbox() {
  const summary = useNotificationSummary()
  const bell = useNotificationSummary()
  const inbox = useNotifications()
  const read = useMarkNotificationRead()
  const readAll = useReadAllNotifications()
  return { summary, bell, inbox, read, readAll }
}
beforeAll(() => notifyManager.setScheduler(callback => callback()))
afterAll(() => notifyManager.setScheduler(callback => setTimeout(callback, 0)))
beforeEach(async () => {
  jest.clearAllMocks()
  await persistSession({ kind: 'user', userId: 'A', accessToken: 'A', expiresAt: Date.now() + 600000 })
  client = new QueryClient({ defaultOptions: {
    queries: { retry: false, staleTime: 30000, gcTime: Infinity },
    mutations: { retry: false, gcTime: Infinity },
  } })
  bindSessionCaches(client)
  mockSummary.mockResolvedValue(snapshot)
  mockList.mockResolvedValue({ notifications: [], nextCursor: null })
  mockRead.mockResolvedValue(undefined)
  mockReadAll.mockResolvedValue(completed)
  mockPoll.mockResolvedValue(completed)
})
afterEach(async () => { client.clear(); await clearSession(); jest.useRealTimers() })

it('opens exactly summary/read-all and keeps the shared count under the purged account prefix, off disk', () => {
  expect(generatedNotificationCapabilities).toEqual({ summary: true, readAll: true, categoryPatch: false,
    categoryFields: false, categoryFilter: false, quietHours: false })
  expect(queryKeys.notificationSummary()[0]).toBe('me')
  expect(shouldPersistQuery(queryKeys.notificationSummary())).toBe(false)
})

it('deduplicates summary consumers and refetches both queries after single-read', async () => {
  const { result } = await renderHook(useInbox, { wrapper })
  expect(mockSummary).toHaveBeenCalledTimes(1)
  expect(result.current.summary.data).toEqual(snapshot)
  expect(result.current.bell.data).toEqual(snapshot)
  mockSummary.mockResolvedValue({ ...snapshot, unreadCount: 700 })
  await act(async () => { await result.current.read.mutateAsync('n-1') })
  expect(mockRead).toHaveBeenCalledWith('n-1', expect.any(Number))
  expect(mockSummary).toHaveBeenCalledTimes(2)
  expect(mockList).toHaveBeenCalledTimes(2)
  expect(result.current.bell.data?.unreadCount).toBe(700)
})

it('read-all 200 sends the summary cutoff and an idempotency key, then refetches instead of setting zero', async () => {
  const { result } = await renderHook(useInbox, { wrapper })
  mockSummary.mockResolvedValue({ ...snapshot, unreadCount: 2, readThroughCursor: 'new-arrivals' })
  await act(async () => { await result.current.readAll.mutateAsync(snapshot.readThroughCursor) })
  expect(mockReadAll).toHaveBeenCalledWith({ through: snapshot.readThroughCursor }, expect.stringMatching(/^[A-Za-z0-9_-]{8,128}$/), expect.any(Number))
  expect(mockPoll).not.toHaveBeenCalled()
  expect(mockSummary).toHaveBeenCalledTimes(2)
  expect(mockList).toHaveBeenCalledTimes(2)
  expect(result.current.summary.data?.unreadCount).toBe(2)
})

it('202 stays pending across running polls, then refetches list and summary only on completion', async () => {
  jest.useFakeTimers()
  mockReadAll.mockResolvedValue(running)
  mockPoll.mockResolvedValueOnce(running).mockResolvedValueOnce(completed)
  const { result } = await renderHook(useInbox, { wrapper })
  let pending!: Promise<unknown>
  await act(async () => { pending = result.current.readAll.mutateAsync(snapshot.readThroughCursor) })
  expect(result.current.readAll.isPending).toBe(true)
  expect(mockSummary).toHaveBeenCalledTimes(1)
  await act(async () => { await jest.advanceTimersByTimeAsync(1000) })
  expect(mockPoll).toHaveBeenCalledWith('op-1', expect.any(Number))
  expect(result.current.readAll.isPending).toBe(true)
  expect(mockList).toHaveBeenCalledTimes(1)
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); await pending })
  expect(result.current.readAll.isPending).toBe(false)
  expect(mockPoll).toHaveBeenCalledTimes(2)
  expect(mockSummary).toHaveBeenCalledTimes(2)
  expect(mockList).toHaveBeenCalledTimes(2)
})

it.each(['post', 'poll'])('read-all %s failure preserves unread state and reports error', async stage => {
  jest.useFakeTimers()
  if (stage === 'post') mockReadAll.mockRejectedValue(new Error('offline'))
  else { mockReadAll.mockResolvedValue(running); mockPoll.mockRejectedValue(new Error('offline')) }
  const { result } = await renderHook(useInbox, { wrapper })
  let pending!: Promise<unknown>
  await act(async () => { pending = result.current.readAll.mutateAsync(snapshot.readThroughCursor).catch(error => error) })
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); await pending })
  expect(result.current.readAll.isError).toBe(true)
  expect(result.current.summary.data).toEqual(snapshot)
  expect(mockSummary).toHaveBeenCalledTimes(1)
  expect(mockList).toHaveBeenCalledTimes(1)
})

it('automatic retry replays the same key and cutoff', async () => {
  jest.useFakeTimers()
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { retry: 1, retryDelay: 1, gcTime: Infinity } })
  mockReadAll.mockRejectedValueOnce(new Error('lost response')).mockResolvedValue(completed)
  const { result } = await renderHook(useInbox, { wrapper })
  let pending!: Promise<unknown>
  await act(async () => { pending = result.current.readAll.mutateAsync(snapshot.readThroughCursor) })
  await act(async () => { await jest.advanceTimersByTimeAsync(1); await pending })
  expect(mockReadAll).toHaveBeenCalledTimes(2)
  expect(mockReadAll.mock.calls[0]).toEqual(mockReadAll.mock.calls[1])
})

it.each(['waiting', 'in-flight poll'])('account switch cancels %s and removes A summary without any B continuation', async stage => {
  jest.useFakeTimers()
  mockReadAll.mockResolvedValue(running)
  let finish!: (value: unknown) => void
  mockPoll.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const { result, unmount } = await renderHook(useInbox, { wrapper })
  let pending!: Promise<unknown>
  await act(async () => { pending = result.current.readAll.mutateAsync(snapshot.readThroughCursor).catch(error => error) })
  if (stage === 'in-flight poll') await act(async () => { await jest.advanceTimersByTimeAsync(1000) })
  await unmount() // The account's screen leaves; its durable operation must still cancel.
  await act(async () => {
    await persistSession({ kind: 'user', userId: 'B', accessToken: 'B', expiresAt: Date.now() + 600000 })
    finish(completed)
    await jest.advanceTimersByTimeAsync(10000)
  })
  expect(await pending).toBeInstanceOf(SessionCancelledError)
  expect(client.getQueryData(queryKeys.notificationSummary())).toBeUndefined()
  expect(mockPoll).toHaveBeenCalledTimes(stage === 'waiting' ? 0 : 1)
  expect(mockSummary).toHaveBeenCalledTimes(1)
  expect(mockList).toHaveBeenCalledTimes(1)
})
