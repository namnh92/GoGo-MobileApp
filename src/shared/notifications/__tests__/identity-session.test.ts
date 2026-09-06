import { describe, expect, it, vi } from 'vitest'

import {
  createIdentitySession,
  type IdentityFetchOutcome,
  type OneSignalIdentity,
} from '../identity-session'

/**
 * NTF-APP-004 (#51). Every acceptance question about identity except "did a
 * phone buzz" is answered here: is the subscription bound to the right person,
 * is it released on logout and on an account switch, and what happens when the
 * environment cannot prove identity at all.
 */

function nativeSpy() {
  let expiredHandler: ((externalId: string) => void) | null = null
  const native: OneSignalIdentity & { fire(externalId: string): void } = {
    loginWithToken: vi.fn(async () => {}),
    loginWithoutToken: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    respondToJwtExpired: vi.fn(async () => {}),
    onJwtExpired: vi.fn((handler: (externalId: string) => void) => {
      expiredHandler = handler
      return { remove: vi.fn() }
    }),
    fire: (externalId: string) => expiredHandler?.(externalId),
  }
  return native
}

const okToken = (externalId: string): IdentityFetchOutcome => ({
  kind: 'ok',
  token: { externalId, token: `jwt-for-${externalId}`, expiresAt: new Date().toISOString() },
})

describe('push identity follows the session', () => {
  it('binds a signed-in user with a verified token', async () => {
    const native = nativeSpy()
    const events: string[] = []
    const s = createIdentitySession({
      native,
      fetchToken: async () => okToken('user-1'),
      report: (e) => events.push(e),
    })
    await s.apply({ kind: 'user', userId: 'user-1' })
    expect(native.loginWithToken).toHaveBeenCalledWith('user-1', 'jwt-for-user-1')
    expect(native.loginWithoutToken).not.toHaveBeenCalled()
    expect(events).toEqual(['push_identity_bound'])
  })

  it('uses the external id the server chose, not the one the client guessed', async () => {
    // The endpoint reads the actor from the session; nothing in the request can
    // pick it. Trusting the response keeps one source of truth.
    const native = nativeSpy()
    const s = createIdentitySession({ native, fetchToken: async () => okToken('server-truth') })
    await s.apply({ kind: 'user', userId: 'client-guess' })
    expect(native.loginWithToken).toHaveBeenCalledWith('server-truth', 'jwt-for-server-truth')
  })

  it('is idempotent: a session refresh does not re-login', async () => {
    const native = nativeSpy()
    const fetchToken = vi.fn(async () => okToken('user-1'))
    const s = createIdentitySession({ native, fetchToken })
    await s.apply({ kind: 'user', userId: 'user-1' })
    await s.apply({ kind: 'user', userId: 'user-1' })
    await s.apply({ kind: 'user', userId: 'user-1' })
    expect(native.loginWithToken).toHaveBeenCalledTimes(1)
    expect(fetchToken).toHaveBeenCalledTimes(1)
  })

  it('releases the subscription on logout', async () => {
    const native = nativeSpy()
    const events: string[] = []
    const s = createIdentitySession({
      native,
      fetchToken: async () => okToken('user-1'),
      report: (e) => events.push(e),
    })
    await s.apply({ kind: 'user', userId: 'user-1' })
    await s.apply(null)
    expect(native.logout).toHaveBeenCalledTimes(1)
    expect(s.boundUserId()).toBeNull()
    expect(events).toEqual(['push_identity_bound', 'push_identity_logged_out'])
  })

  it('logs out before binding the next person on an account switch', async () => {
    // One device must never answer to two people. Order matters, so it is the
    // order that is asserted.
    const native = nativeSpy()
    const calls: string[] = []
    const s = createIdentitySession({
      native: {
        ...native,
        logout: vi.fn(async () => {
          calls.push('logout')
        }),
        loginWithToken: vi.fn(async (id: string) => {
          calls.push(`login:${id}`)
        }),
      },
      fetchToken: async () => okToken('user-2'),
    })
    await s.apply({ kind: 'user', userId: 'user-1' })
    calls.length = 0
    await s.apply({ kind: 'user', userId: 'user-2' })
    expect(calls).toEqual(['logout', 'login:user-2'])
  })

  it('never binds a guest — a room session is not a person', async () => {
    const native = nativeSpy()
    const s = createIdentitySession({ native, fetchToken: async () => okToken('nope') })
    await s.apply({ kind: 'guest' })
    expect(native.loginWithToken).not.toHaveBeenCalled()
    expect(native.loginWithoutToken).not.toHaveBeenCalled()
  })

  it('leaves the device unbound when the environment cannot prove identity', async () => {
    // The DEV state until a signing key exists. Unbound is the honest answer:
    // nothing is delivered to this user, rather than delivered unverified.
    const native = nativeSpy()
    const events: string[] = []
    const s = createIdentitySession({
      native,
      fetchToken: async () => ({ kind: 'unavailable' }),
      report: (e) => events.push(e),
    })
    await s.apply({ kind: 'user', userId: 'user-1' })
    expect(native.loginWithToken).not.toHaveBeenCalled()
    expect(native.loginWithoutToken).not.toHaveBeenCalled()
    expect(s.boundUserId()).toBeNull()
    expect(events).toEqual(['push_identity_unavailable'])
  })

  it('falls back to an unverified login only when asked by name', async () => {
    const native = nativeSpy()
    const events: string[] = []
    const s = createIdentitySession({
      native,
      fetchToken: async () => ({ kind: 'unavailable' }),
      report: (e) => events.push(e),
      allowUnverified: true,
    })
    await s.apply({ kind: 'user', userId: 'user-1' })
    expect(native.loginWithoutToken).toHaveBeenCalledWith('user-1')
    expect(events).toEqual(['push_identity_unverified'])
  })

  it('a denied token leaves the device unbound and retries on the next session change', async () => {
    const native = nativeSpy()
    const outcomes: IdentityFetchOutcome[] = [{ kind: 'error' }, okToken('user-1')]
    const s = createIdentitySession({ native, fetchToken: async () => outcomes.shift()! })
    await s.apply({ kind: 'user', userId: 'user-1' })
    expect(s.boundUserId()).toBeNull()
    await s.apply({ kind: 'user', userId: 'user-1' })
    expect(native.loginWithToken).toHaveBeenCalledWith('user-1', 'jwt-for-user-1')
  })

  it('answers the SDK with a fresh token when the old one expires', async () => {
    const native = nativeSpy()
    const events: string[] = []
    const s = createIdentitySession({
      native,
      fetchToken: async () => okToken('user-1'),
      report: (e) => events.push(e),
    })
    s.start()
    native.fire('user-1')
    await vi.waitFor(() => expect(native.respondToJwtExpired).toHaveBeenCalled())
    expect(native.respondToJwtExpired).toHaveBeenCalledWith('user-1', 'jwt-for-user-1')
    expect(events).toContain('push_identity_refreshed')
  })

  it('a failed refresh reports and leaves the request open rather than throwing', async () => {
    const native = nativeSpy()
    const events: string[] = []
    const s = createIdentitySession({
      native,
      fetchToken: async () => ({ kind: 'error' }),
      report: (e) => events.push(e),
    })
    s.start()
    expect(() => native.fire('user-1')).not.toThrow()
    await vi.waitFor(() => expect(events).toContain('push_identity_refresh_failed'))
    expect(native.respondToJwtExpired).not.toHaveBeenCalled()
  })
})
