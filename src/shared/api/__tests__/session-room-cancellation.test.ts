import { QueryClient } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'

import { createPollingTransport, createSseTransport, resetPollingTransportForTests, resetSseTransportForTests } from '../realtime/transport'
import type { SseConnectOptions } from '../realtime/sse-connection'
import { clearSession, persistSession } from '../session'

vi.mock('../../analytics', () => ({ track: vi.fn() }))
vi.mock('../realtime/app-activity', () => ({ appActivity: { isActive: () => true, subscribe: () => () => undefined } }))
const activity = { isActive: () => true, subscribe: () => () => undefined }
afterEach(async () => { resetSseTransportForTests(); resetPollingTransportForTests(); vi.useRealTimers(); await clearSession() })

it.each(['polling', 'open stream', 'reconnect backoff'] as const)('drops A room %s when its session ends', async mode => {
  await persistSession({ kind: 'user', userId: 'A', accessToken: 'A', expiresAt: Date.now() + 600_000 })
  vi.useFakeTimers()
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue()
  const auth = vi.fn(async () => ({ token: 'A', expiresAt: Date.now() + 900_000 }))
  const close = vi.fn()
  let socket: SseConnectOptions | undefined
  const connect = vi.fn((options: SseConnectOptions) => { socket = options; return { close } })
  const fallback = { kind: 'polling' as const, subscribe: vi.fn(() => () => undefined) }
  const transport = mode === 'polling' ? createPollingTransport(activity) : createSseTransport({
    activity, auth, connect, fallback, safety: fallback, random: () => 0,
  })
  const stop = transport.subscribe({ roomId: 'room-A', phase: 'lobby', queryClient: client })
  await vi.advanceTimersByTimeAsync(0)
  if (mode === 'reconnect backoff') socket?.onClose({ status: 500 })
  const before = auth.mock.calls.length
  await clearSession()
  await persistSession({ kind: 'user', userId: 'B', accessToken: 'B', expiresAt: Date.now() + 600_000 })
  await vi.advanceTimersByTimeAsync(60_000)
  expect(auth).toHaveBeenCalledTimes(before)
  expect(invalidate).not.toHaveBeenCalled()
  if (mode === 'open stream') expect(close).toHaveBeenCalled()
  stop()
  client.clear()
})
