import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react-native'

/**
 * GoGo-MobileApp#199: a host's stored invite codes belong to that account. The
 * same purge that clears room data on logout and account deletion clears them.
 */

jest.mock('@/shared/notifications/logout-confirmation-bootstrap', () => ({
  unsubscribeCurrentDeviceAndConfirm: jest.fn(async () => undefined),
}))
jest.mock('@/shared/api/endpoints/sessions', () => ({
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(async () => undefined),
  deleteAccount: jest.fn(async () => undefined),
}))
jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true })),
}))

import { SessionProvider, useSession } from '@/shared/providers/session-provider'
import { loadInviteCode, saveInviteCode } from '@/shared/storage/invite-codes'

const ROOMS = ['311f5bd8-f853-4ced-af68-e04398d1451a', '9b0f6c2e-1d7a-4c55-9a51-3f0b5e2d8c11']

type SessionApi = ReturnType<typeof useSession>

it.each(['signOut', 'deleteAccount'] as const)('%s removes every stored invite code', async action => {
  for (const roomId of ROOMS) {
    await saveInviteCode({ roomId, inviteId: `invite-${roomId}`, code: `code-${roomId}`, expiresAt: '2099-01-01T00:00:00.000Z', savedAt: 1 })
  }
  expect(await loadInviteCode(ROOMS[0])).not.toBeNull()

  const ref: { current: SessionApi | null } = { current: null }
  function Probe() {
    ref.current = useSession()
    return null
  }
  const client = new QueryClient()
  await render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <Probe />
      </SessionProvider>
    </QueryClientProvider>,
  )
  await act(async () => { await ref.current?.[action]() })

  for (const roomId of ROOMS) expect(await loadInviteCode(roomId)).toBeNull()
  client.clear()
})
