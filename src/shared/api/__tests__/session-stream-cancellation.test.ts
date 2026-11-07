import { afterEach, expect, it, vi } from 'vitest'

import { createHttpAssistantStreamOpener, followAssistantReply } from '../realtime/assistant-stream'
import { clearSession, persistSession, type Session } from '../session'

const A: Session = { kind: 'user', userId: 'A', accessToken: 'A', expiresAt: Date.now() + 600_000 }
afterEach(async () => { vi.useRealTimers(); await clearSession() })

it('cancels an assistant stream reconnect timer when A ends', async () => {
  await persistSession(A)
  vi.useFakeTimers()
  const close = vi.fn()
  const open = vi.fn(options => {
    options.onClose({ status: 503 })
    return { close }
  })
  const follower = followAssistantReply({ conversationId: 'c-A', messageId: 'm-A', open, onEvent: vi.fn() })
  expect(open).toHaveBeenCalledTimes(1)
  await clearSession()
  await persistSession({ ...A, userId: 'B', accessToken: 'B' })
  await vi.advanceTimersByTimeAsync(60_000)
  expect(open).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
  follower.close()
})

it('does not open A socket when its bearer lookup resolves after B signs in', async () => {
  await persistSession(A)
  let release!: (value: { token: string; expiresAt: number }) => void
  const grant = vi.fn(() => new Promise<{ token: string; expiresAt: number }>(resolve => { release = resolve }))
  const connector = vi.fn(() => ({ close: vi.fn() }))
  const onClose = vi.fn()
  const connection = createHttpAssistantStreamOpener(connector, grant)({
    conversationId: 'c-A', messageId: 'm-A', lastEventId: null,
    onOpen: vi.fn(), onEvent: vi.fn(), onClose,
  })
  await persistSession({ ...A, userId: 'B', accessToken: 'B' })
  release({ token: 'A', expiresAt: A.expiresAt })
  await new Promise<void>(resolve => setImmediate(resolve))
  expect(connector).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
  connection.close()
})
