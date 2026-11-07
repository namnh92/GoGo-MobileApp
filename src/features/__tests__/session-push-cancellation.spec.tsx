import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render } from '@testing-library/react-native'
import { OneSignal } from 'react-native-onesignal'

// Keep the provider, push queue, confirmation routine and HTTP client real.
// Only native boundaries and bootstrap assembly are supplied by the test.
jest.mock('react-native-onesignal', () => ({
  OneSignal: { User: { pushSubscription: { getIdAsync: jest.fn(async () => 'sub-A') } } },
}))
jest.mock('../../../modules/onesignal-identity', () => ({
  loginWithToken: jest.fn(async () => {}),
  loginWithoutToken: jest.fn(async () => {}),
  logout: jest.fn(async () => {}),
  respondToJwtExpired: jest.fn(async () => {}),
  onJwtExpired: jest.fn(() => ({ remove: jest.fn() })),
}))
jest.mock('@/shared/notifications/identity-bootstrap', () => {
  const { createIdentitySession } = jest.requireActual('@/shared/notifications/identity-session')
  const { unsubscribeCurrentDeviceAndConfirm } = jest.requireActual('@/shared/notifications/logout-confirmation-bootstrap')
  const { getSession } = jest.requireActual('@/shared/api/session')
  return {
    pushIdentity: createIdentitySession({
      native: jest.requireMock('../../../modules/onesignal-identity'),
      fetchToken: async () => ({ kind: 'ok', token: { externalId: getSession().userId, token: 'jwt', expiresAt: '' } }),
      confirmSignOut: unsubscribeCurrentDeviceAndConfirm,
    }),
  }
})
jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true })),
}))

import * as native from '../../../modules/onesignal-identity'
import { clearSession, getSession, getSessionGeneration, persistSession, SessionCancelledError, subscribeToSession, type Session } from '@/shared/api/session'
import { pushIdentity } from '@/shared/notifications/identity-bootstrap'
import { SessionProvider, useSession } from '@/shared/providers/session-provider'

it('F-08: B sign-in cancels the real A push continuation held at the subscription lookup', async () => {
  const A: Session = { kind: 'user', userId: 'A', accessToken: 'access-A', expiresAt: Date.now() + 600_000 }
  await persistSession(A)
  await pushIdentity.apply(A)
  const unsubscribe = subscribeToSession(value => { void pushIdentity.apply(value) })
  let release!: (id: string) => void
  jest.mocked(OneSignal.User.pushSubscription.getIdAsync).mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const fetch = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify({ userId: 'B', accessToken: 'access-B', refreshToken: 'refresh-B', expiresIn: 900 }),
  } as Response)
  const begin = jest.spyOn(pushIdentity, 'beginSignOut') // Observe; do not replace the real continuation.
  const client = new QueryClient()
  let session!: ReturnType<typeof useSession>
  function Probe() { session = useSession(); return null }
  const view = await render(<QueryClientProvider client={client}><SessionProvider><Probe /></SessionProvider></QueryClientProvider>)
  let ending!: Promise<unknown>
  try {
    await act(async () => { ending = session.signOut().catch(error => error) })
    expect(OneSignal.User.pushSubscription.getIdAsync).toHaveBeenCalledTimes(1)
    expect(begin).toHaveBeenCalledWith('user', expect.objectContaining({ generation: getSessionGeneration(), signal: expect.anything() }))
    await act(async () => { await session.signIn({ email: 'b@example.com', password: 'test-password' }) })
    expect(await ending).toBeInstanceOf(SessionCancelledError)
    // B's bind must finish while the old native lookup remains unresolved.
    await pushIdentity.settled()
    expect(pushIdentity.boundUserId()).toBe('B')
    const logouts = jest.mocked(native.logout).mock.calls.length
    release('sub-A')
    await act(async () => { await Promise.resolve() })
    expect(native.logout).toHaveBeenCalledTimes(logouts)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String(fetch.mock.calls[0][0])).toContain('/auth/login')
    expect(getSession()?.userId).toBe('B')
    expect(session.status).toBe('user')
  } finally {
    release?.('sub-A')
    unsubscribe()
    await act(async () => { await view.unmount() })
    client.clear()
    await clearSession()
    jest.restoreAllMocks()
  }
})
