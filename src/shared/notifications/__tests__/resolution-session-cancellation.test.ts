import { afterEach, expect, it, vi } from 'vitest'

import { resolveInboxTarget } from '@/features/notifications/inbox-target'
import { currentAccessGrant } from '@/shared/api/client'
import { createQueryClient } from '@/shared/api/query-client'
import { clearSession, persistSession, SessionCancelledError } from '@/shared/api/session'
import type { Notification } from '@/shared/api/types'
import { openNotificationTarget } from '../notification-open'
import type { OpenNotificationDeps } from '../notification-open'
import type { NotificationTarget } from '../notification-target'

vi.mock('react-native', () => ({ AppState: { addEventListener: vi.fn() }, Platform: { OS: 'android' } }))
vi.mock('expo-network', () => ({ addNetworkStateListener: vi.fn(), getNetworkStateAsync: vi.fn() }))
vi.mock('@/shared/analytics', () => ({ track: vi.fn() }))
vi.mock('@/shared/navigation/open-deep-link', () => ({ openDeepLinkAction: vi.fn() }))
vi.mock('@/shared/api', async () => ({
  ...await import('@/shared/api/endpoints/plans'),
  ...await import('@/shared/api/endpoints/rooms'),
  ...await import('@/shared/api/errors'),
}))

const ROOM = '503d1407-1c2b-4a5d-9e8f-7a6b5c4d3e2f'
const PLAN = '94b894df-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const clients: ReturnType<typeof createQueryClient>[] = []
afterEach(async () => {
  clients.splice(0).forEach(client => client.clear())
  vi.restoreAllMocks()
  await clearSession()
})

it.each([
  { source: 'inbox', named: true }, { source: 'inbox', named: false },
  { source: 'push', named: true }, { source: 'push', named: false },
])('F-06: session expiry terminates the $source network resolution (named plan: $named) before a room lookup', async ({ source, named }) => {
  await persistSession({ kind: 'user', userId: 'A', accessToken: 'A', refreshToken: 'refresh-A', expiresAt: Date.now() + 600_000 })
  const client = createQueryClient()
  clients.push(client)
  let release!: (response: Response) => void
  const fetch = vi.spyOn(globalThis, 'fetch')
    .mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    .mockResolvedValue(new Response(JSON.stringify({ code: 'SESSION_REVOKED' }), { status: 401, headers: { 'content-type': 'application/json' } }))
  const router = { push: vi.fn(), replace: vi.fn(), navigate: vi.fn() }
  const action = named ? { kind: 'plan', planId: PLAN } : { kind: 'room', roomId: ROOM }
  const target = { status: 'open', action, roomId: ROOM, kind: 'date_reminder', key: 'n1' } as NotificationTarget
  const result = (source === 'inbox'
    ? resolveInboxTarget({ kind: 'date_reminder', payload: { roomId: ROOM, ...(named ? { planId: PLAN } : {}) } } as Notification)
    : openNotificationTarget(target, { queryClient: client, status: 'user', router: router as unknown as OpenNotificationDeps['router'] }))
    .catch(error => error)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  await currentAccessGrant({ force: true })
  expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true)
  release(new Response(JSON.stringify({ id: PLAN, status: 'current' }), { headers: { 'content-type': 'application/json' } }))
  const decision = await result
  expect(fetch).toHaveBeenCalledTimes(2) // Initial plan + failed refresh; no anonymous room lookup.
  expect(decision).toBeInstanceOf(SessionCancelledError)
  expect(router.push).not.toHaveBeenCalled()
})
