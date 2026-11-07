import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react-native'

/**
 * GoGo-MobileApp#279 — a guest has to be able to sign out. The push check the
 * sign-out runs first is for signed-in users (the backend answers 403
 * USER_ONLY to a guest), so the provider must say which actor is leaving.
 *
 * #398 (R-21) — and the device must come back to a person who stays signed in.
 */

const mockUnsubscribe = jest.fn(async (_actor?: 'user' | 'guest') => undefined)
const mockCancel = jest.fn(async () => undefined)
const mockServerLogout = jest.fn(async () => undefined)
const mockCurrent: { kind: 'user' | 'guest' } = { kind: 'guest' }

jest.mock('@/shared/notifications/identity-bootstrap', () => ({
  pushIdentity: {
    beginSignOut: (actor?: 'user' | 'guest') => mockUnsubscribe(actor),
    cancelSignOut: () => mockCancel(),
  },
}))
jest.mock('@/shared/api/endpoints/sessions', () => ({
  logout: async () => {
    await mockServerLogout()
    await jest.requireActual('@/shared/api/session').clearSession()
  },
}))
jest.mock('@/shared/api/session', () => ({
  ...jest.requireActual('@/shared/api/session'),
  getSession: () =>
    mockCurrent.kind === 'guest'
      ? { kind: 'guest', accessToken: 'token', expiresAt: 0, roomId: 'room-1', guestSessionId: 'g-1' }
      : { kind: 'user', accessToken: 'token', expiresAt: 0, userId: 'user-1' },
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

async function signOutAs(kind: 'user' | 'guest') {
  mockCurrent.kind = kind
  mockUnsubscribe.mockClear()
  let session: SessionApi | null = null
  const client = new QueryClient()
  const view = await render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <Probe onSession={value => { session = value }} />
      </SessionProvider>
    </QueryClientProvider>,
  )
  await act(async () => { await (session as unknown as SessionApi).signOut() })
  await act(async () => { await view.unmount() })
  client.clear()
}

it('tells the push check a guest is leaving', async () => {
  await signOutAs('guest')
  expect(mockUnsubscribe).toHaveBeenCalledWith('guest')
})

it('keeps confirming a signed-in user', async () => {
  await signOutAs('user')
  expect(mockUnsubscribe).toHaveBeenCalledWith('user')
})

async function failingSignOut() {
  mockCurrent.kind = 'user'
  mockCancel.mockClear()
  let session: SessionApi | null = null
  const client = new QueryClient()
  const view = await render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <Probe onSession={value => { session = value }} />
      </SessionProvider>
    </QueryClientProvider>,
  )
  let failure: unknown
  await act(async () => {
    await (session as unknown as SessionApi).signOut().catch(error => { failure = error })
  })
  await act(async () => { await view.unmount() })
  client.clear()
  return failure
}

it('binds the device back when the push check refuses: the person is still signed in', async () => {
  mockUnsubscribe.mockRejectedValueOnce(new Error('not confirmed'))
  expect(await failingSignOut()).toBeInstanceOf(Error)
  expect(mockCancel).toHaveBeenCalledTimes(1)
})

it('binds the device back when the server refuses the sign-out after the push check passed', async () => {
  mockServerLogout.mockRejectedValueOnce(new Error('503'))
  expect(await failingSignOut()).toBeInstanceOf(Error)
  expect(mockCancel).toHaveBeenCalledTimes(1)
})
