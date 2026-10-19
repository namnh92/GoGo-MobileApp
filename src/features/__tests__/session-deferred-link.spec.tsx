import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react-native'

/**
 * GoGo-MobileApp#364 — a deferred link is the install's intent. Signing out
 * drops it so the next person on the device is not sent to someone else's
 * invite; signing in keeps it, because the person who followed the invite
 * usually has to sign in before it can open.
 */

const mockClear = jest.fn(async () => undefined)

jest.mock('@/shared/acquisition/pending-deep-links', () => ({
  pendingDeepLinks: { clear: () => mockClear() },
}))
jest.mock('@/shared/notifications/logout-confirmation-bootstrap', () => ({
  unsubscribeCurrentDeviceAndConfirm: jest.fn(async () => undefined),
}))
jest.mock('@/shared/api/endpoints/sessions', () => ({
  logout: jest.fn(async () => undefined),
  login: jest.fn(async () => ({})),
  deleteAccount: jest.fn(async () => undefined),
}))
jest.mock('@/shared/api/session', () => ({
  ...jest.requireActual('@/shared/api/session'),
  getSession: () => ({ kind: 'user', accessToken: 'token', expiresAt: 0, userId: 'user-1' }),
}))
jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true })),
}))

import { SessionProvider, useSession } from '@/shared/providers/session-provider'

type SessionApi = ReturnType<typeof useSession>

function Probe({ onSession }: { onSession: (value: SessionApi) => void }) {
  onSession(useSession())
  return null
}

async function withSession(run: (session: SessionApi) => Promise<unknown>) {
  mockClear.mockClear()
  let session: SessionApi | null = null
  const client = new QueryClient()
  const view = await render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <Probe onSession={value => { session = value }} />
      </SessionProvider>
    </QueryClientProvider>,
  )
  await act(async () => { await run(session as unknown as SessionApi) })
  await act(async () => { await view.unmount() })
  client.clear()
}

it('drops the pending deferred link at sign-out', async () => {
  await withSession(session => session.signOut())
  expect(mockClear).toHaveBeenCalledTimes(1)
})

it('drops it when the account is deleted', async () => {
  await withSession(session => session.deleteAccount())
  expect(mockClear).toHaveBeenCalledTimes(1)
})

it('keeps it through sign-in, so the invite opens afterwards', async () => {
  await withSession(session => session.signIn({ email: 'a@example.com', password: 'x' } as never))
  expect(mockClear).not.toHaveBeenCalled()
})
