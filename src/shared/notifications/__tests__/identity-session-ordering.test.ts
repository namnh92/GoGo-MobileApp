import { describe, expect, it, vi } from 'vitest'

import { createIdentitySession, type IdentityFetchOutcome, type OneSignalIdentity } from '../identity-session'

/**
 * GoGo-MobileApp#398 D3, R-21: a transition that has been overtaken performs no
 * native mutation. Both cases failed on the code before the coordinator.
 */

function nativeSpy() {
  let expiredHandler: ((externalId: string) => void) | null = null
  const calls: string[] = []
  const native: OneSignalIdentity & { fire(externalId: string): void } = {
    loginWithToken: vi.fn(async (id: string) => {
      calls.push(`login:${id}`)
    }),
    loginWithoutToken: vi.fn(async () => {}),
    logout: vi.fn(async () => {
      calls.push('logout')
    }),
    respondToJwtExpired: vi.fn(async (id: string) => {
      calls.push(`respond:${id}`)
    }),
    onJwtExpired: vi.fn((handler: (externalId: string) => void) => {
      expiredHandler = handler
      return { remove: vi.fn() }
    }),
    fire: (externalId: string) => expiredHandler?.(externalId),
  }
  return { native, calls }
}

const okToken = (externalId: string): IdentityFetchOutcome => ({
  kind: 'ok',
  token: { externalId, token: `jwt-for-${externalId}`, expiresAt: new Date().toISOString() },
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => {
    resolve = r
  })
  return { promise, resolve }
}

describe('an overtaken transition', () => {
  it('does not log in once sign-out arrived during the token fetch', async () => {
    const { native, calls } = nativeSpy()
    const fetch = deferred<IdentityFetchOutcome>()
    const fetchToken = vi.fn(() => fetch.promise)
    const s = createIdentitySession({ native, fetchToken })

    const signingIn = s.apply({ kind: 'user', userId: 'A' })
    // The fetch is on the wire: this is the gap between it and the login.
    await vi.waitFor(() => expect(fetchToken).toHaveBeenCalled())
    const signedOut = s.apply(null)
    fetch.resolve(okToken('A'))
    await Promise.all([signingIn, signedOut])
    await s.settled()

    expect(calls).not.toContain('login:A')
    expect(s.boundUserId()).toBeNull()
  })

  it('A, out, A again ends bound to A with one login, whatever the first fetch returned', async () => {
    const { native, calls } = nativeSpy()
    const first = deferred<IdentityFetchOutcome>()
    const fetches = [first.promise, Promise.resolve(okToken('A'))]
    const s = createIdentitySession({ native, fetchToken: () => fetches.shift()! })

    const a1 = s.apply({ kind: 'user', userId: 'A' })
    const out = s.apply(null)
    const a2 = s.apply({ kind: 'user', userId: 'A' })
    first.resolve(okToken('A'))
    await Promise.all([a1, out, a2])
    await s.settled()

    expect(calls.filter(call => call === 'login:A')).toHaveLength(1)
    expect(s.boundUserId()).toBe('A')
  })

  it('a token refresh that outlives the account does not answer the SDK', async () => {
    const { native, calls } = nativeSpy()
    const refresh = deferred<IdentityFetchOutcome>()
    const fetches = [Promise.resolve(okToken('A')), refresh.promise]
    const s = createIdentitySession({ native, fetchToken: () => fetches.shift()! })
    s.start()
    await s.apply({ kind: 'user', userId: 'A' })

    native.fire('A')
    await s.apply(null)
    refresh.resolve(okToken('A'))
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(calls).toEqual(['login:A', 'logout'])
  })
})
