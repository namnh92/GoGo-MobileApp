import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react-native'

/**
 * GoGo-MobileApp#199: a host's stored invite codes belong to that account. The
 * purge that clears room data — logout, account deletion, signing in, and an
 * expired session — clears them too.
 */

const mockExpiry: { callback: (() => void) | null } = { callback: null }

jest.mock('@/shared/notifications/logout-confirmation-bootstrap', () => ({
  unsubscribeCurrentDeviceAndConfirm: jest.fn(async () => undefined),
}))
jest.mock('@/shared/api/endpoints/sessions', () => ({
  login: jest.fn(async () => ({ kind: 'user', accessToken: 'token', expiresAt: 0, userId: 'user-2' })),
  register: jest.fn(),
  logout: jest.fn(async () => undefined),
  deleteAccount: jest.fn(async () => undefined),
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

import { SessionProvider, useSession } from '@/shared/providers/session-provider'
import { loadInviteCode, saveInviteCode } from '@/shared/storage/invite-codes'

type SessionApi = ReturnType<typeof useSession>

const USER = 'user-1'
const ROOMS = ['311f5bd8-f853-4ced-af68-e04398d1451a', '9b0f6c2e-1d7a-4c55-9a51-3f0b5e2d8c11']
let session: SessionApi | null = null

/** Hands the provider's API to the test through a prop, not by writing an outer variable. */
function Probe({ onSession }: { onSession: (value: SessionApi) => void }) {
  onSession(useSession())
  return null
}

let client: QueryClient

async function seedAndMount() {
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
] as const)('%s removes every stored invite code', async (_name, action) => {
  await seedAndMount()
  await act(async () => { await action(session as SessionApi) })
  await expectPurgedThenUnmount()
})

it('an expired session removes every stored invite code', async () => {
  await seedAndMount()
  expect(mockExpiry.callback).not.toBeNull()
  await act(async () => { mockExpiry.callback?.() })
  await expectPurgedThenUnmount()
})
