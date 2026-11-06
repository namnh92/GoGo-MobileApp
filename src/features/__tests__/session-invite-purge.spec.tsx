import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react-native'

/**
 * GoGo-MobileApp#199: a host's stored invite codes belong to that account. The
 * purge that clears room data — logout, account deletion, signing in or up,
 * joining as a guest, and an expired session — clears them too, together with
 * the discovery area (#515 F-09).
 */

const mockExpiry: { callback: (() => void) | null } = { callback: null }

jest.mock('@/shared/notifications/identity-bootstrap', () => ({
  pushIdentity: { beginSignOut: jest.fn(async () => undefined), cancelSignOut: jest.fn(async () => undefined) },
}))
jest.mock('@/shared/api/endpoints/sessions', () => ({
  login: jest.fn(async () => ({ kind: 'user', accessToken: 'token', expiresAt: 0, userId: 'user-2' })),
  register: jest.fn(async () => ({ kind: 'user', accessToken: 'token', expiresAt: 0, userId: 'user-3' })),
  logout: jest.fn(async () => undefined),
  deleteAccount: jest.fn(async () => undefined),
}))
jest.mock('@/shared/api/endpoints/rooms', () => ({
  ...jest.requireActual('@/shared/api/endpoints/rooms'),
  joinRoomAsGuest: jest.fn(async (_body: unknown, beforePersist?: () => Promise<void>) => { await beforePersist?.(); return { kind: 'guest', accessToken: 'token', expiresAt: 0, roomId: 'room-1' } }),
}))
jest.mock('@/shared/api/client', () => ({
  ...jest.requireActual('@/shared/api/client'),
  setOnSessionExpired: (callback: (() => void) | null) => {
    mockExpiry.callback = callback
  },
}))
jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true })),
}))

import * as rooms from '@/shared/api/endpoints/rooms'
import * as sessions from '@/shared/api/endpoints/sessions'
import { clearSession, persistSession, type Session } from '@/shared/api/session'
import { useDiscoveryAreaStore } from '@/features/search/discovery-area-store'
import { SessionProvider, useSession } from '@/shared/providers/session-provider'
import { loadInviteCode, saveInviteCode } from '@/shared/storage/invite-codes'

type SessionApi = ReturnType<typeof useSession>

const USER = 'user-1'
const AREA = { datasetVersion: 'ds-2026', provinceCode: '01', provinceName: 'Thành phố Hà Nội', communeCode: null, communeName: null }
const ROOMS = ['311f5bd8-f853-4ced-af68-e04398d1451a', '9b0f6c2e-1d7a-4c55-9a51-3f0b5e2d8c11']
let session: SessionApi | null = null

/** Hands the provider's API to the test through a prop, not by writing an outer variable. */
function Probe({ onSession }: { onSession: (value: SessionApi) => void }) {
  onSession(useSession())
  return null
}

let client: QueryClient

async function seedAndMount() {
  useDiscoveryAreaStore.getState().setArea(AREA)
  for (const roomId of ROOMS) {
    await saveInviteCode({ roomId, inviteId: `invite-${roomId}`, code: `code-${roomId}`, expiresAt: '2099-01-01T00:00:00.000Z', userId: USER, savedAt: 1 })
  }
  expect(await loadInviteCode(ROOMS[0], USER)).not.toBeNull()
  client = new QueryClient()
  await render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <Probe onSession={value => { session = value }} />
      </SessionProvider>
    </QueryClientProvider>,
  )
}

async function expectPurgedThenUnmount() {
  expect(useDiscoveryAreaStore.getState().area).toBeNull()
  await waitFor(async () => {
    for (const roomId of ROOMS) expect(await loadInviteCode(roomId, USER)).toBeNull()
  })
  await act(async () => { await screen.unmount() })
  client.clear()
}

it.each([
  ['signOut', (session: SessionApi) => session.signOut()],
  ['deleteAccount', (session: SessionApi) => session.deleteAccount()],
  ['signIn', (session: SessionApi) => session.signIn({ email: 'host@example.com', password: 'not-a-real-password' } as never)],
  ['signUp', (session: SessionApi) => session.signUp({ email: 'new@example.com', password: 'not-a-real-password' } as never)],
  ['joinAsGuest', (session: SessionApi) => session.joinAsGuest({ inviteCode: 'not-a-code', displayName: 'Khách' } as never)],
] as const)('%s removes every stored invite code and the discovery area', async (_name, action) => {
  await seedAndMount()
  await act(async () => { await action(session as SessionApi) })
  await expectPurgedThenUnmount()
})

it('an expired session removes every stored invite code and the discovery area', async () => {
  await seedAndMount()
  expect(mockExpiry.callback).not.toBeNull()
  await act(async () => { mockExpiry.callback?.() })
  await expectPurgedThenUnmount()
})

it('a rejected guest join preserves the current room cache and invite codes', async () => {
  jest.mocked(rooms.joinRoomAsGuest).mockRejectedValueOnce(new Error('not joinable'))
  await seedAndMount()
  client.setQueryData(['existing-room'], { title: 'Current room' })
  await act(async () => {
    await expect(session!.joinAsGuest({ inviteCode: 'bad', displayName: 'Guest' })).rejects.toThrow('not joinable')
  })
  expect(await loadInviteCode(ROOMS[0], USER)).not.toBeNull()
  expect(client.getQueryData(['existing-room'])).toEqual({ title: 'Current room' })
  expect(useDiscoveryAreaStore.getState().area).toEqual(AREA)
  await act(async () => { await screen.unmount() })
  client.clear()
  useDiscoveryAreaStore.getState().setArea(null)
})

it.each([false, true])('clears A’s area before B signs in (sign out first: %s)', async signOutFirst => {
  const userA: Session = { kind: 'user', userId: USER, accessToken: 'token-a', expiresAt: Date.now() + 900_000 }
  const userB: Session = { ...userA, userId: 'user-2', accessToken: 'token-b' }
  await persistSession(userA)
  await seedAndMount()
  expect(session!.session?.userId).toBe(USER)
  expect(useDiscoveryAreaStore.getState().area).toEqual(AREA)

  if (signOutFirst) {
    jest.mocked(sessions.logout).mockImplementationOnce(() => clearSession())
    await act(async () => { await session!.signOut() })
    expect(session!.status).toBe('anonymous')
    expect(useDiscoveryAreaStore.getState().area).toBeNull()
  }

  jest.mocked(sessions.login).mockImplementationOnce(() => {
    expect(useDiscoveryAreaStore.getState().area).toBeNull()
    return persistSession(userB)
  })
  await act(async () => { await session!.signIn({ email: 'b@example.com', password: 'not-a-real-password' }) })
  expect(session!.session?.userId).toBe('user-2')
  await expectPurgedThenUnmount()
  await clearSession()
})
