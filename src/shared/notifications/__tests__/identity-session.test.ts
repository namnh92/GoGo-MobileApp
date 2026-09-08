import { describe, expect, it, vi } from 'vitest'

import {
  createIdentitySession,
  MAX_CONSECUTIVE_JWT_REFRESHES,
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

describe('a token the provider keeps refusing', () => {
  /**
   * The DEV emulator, 2026-09-07: OneSignal answered 401 to a correctly-signed
   * ES256 token, invalidated it and asked for another — every ~5.8 seconds,
   * indefinitely, one API call each time.
   */
  function refusingProvider() {
    let notify: ((externalId: string) => void) | undefined
    const native = {
      loginWithToken: vi.fn().mockResolvedValue(undefined),
      loginWithoutToken: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      // Refusing the replacement is what makes this a loop rather than a retry.
      respondToJwtExpired: vi.fn().mockImplementation(async () => {
        notify?.('user-1')
      }),
      onJwtExpired: (handler: (externalId: string) => void) => {
        notify = handler
        return { remove: () => { notify = undefined } }
      },
    }
    return { native, expire: () => notify?.('user-1') }
  }

  const token = { externalId: 'user-1', token: 'jwt', expiresAt: '2026-01-01T00:00:00.000Z' }

  it('stops after a bounded number of replacements', async () => {
    const { native, expire } = refusingProvider()
    const fetchToken = vi.fn().mockResolvedValue({ kind: 'ok' as const, token })
    const report = vi.fn()
    const session = createIdentitySession({ native, fetchToken, report })

    session.start()
    expire()
    await vi.waitFor(() =>
      expect(report).toHaveBeenCalledWith('push_identity_refresh_rejected_repeatedly'),
    )
    // Settle any work already scheduled before counting.
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(fetchToken).toHaveBeenCalledTimes(MAX_CONSECUTIVE_JWT_REFRESHES)
    expect(native.respondToJwtExpired).toHaveBeenCalledTimes(MAX_CONSECUTIVE_JWT_REFRESHES)
  })

  it('says so once, not on every attempt', async () => {
    const { native, expire } = refusingProvider()
    const report = vi.fn()
    const session = createIdentitySession({
      native,
      fetchToken: vi.fn().mockResolvedValue({ kind: 'ok' as const, token }),
      report,
    })

    session.start()
    expire()
    await new Promise((resolve) => setTimeout(resolve, 50))

    const complaints = report.mock.calls.filter(
      ([event]) => event === 'push_identity_refresh_rejected_repeatedly',
    )
    expect(complaints).toHaveLength(1)
  })

  it('gives a newly signed-in user a fresh budget', async () => {
    const { native, expire } = refusingProvider()
    const fetchToken = vi.fn().mockResolvedValue({ kind: 'ok' as const, token })
    const session = createIdentitySession({ native, fetchToken })

    session.start()
    expire()
    await new Promise((resolve) => setTimeout(resolve, 50))
    const afterFirstUser = fetchToken.mock.calls.length

    // A different person's refusals say nothing about this one.
    await session.apply({ kind: 'user', userId: 'user-2' })
    expire()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(fetchToken.mock.calls.length).toBeGreaterThan(afterFirstUser + 1)
  })
})

describe('recovering the refresh budget', () => {
  const token = { externalId: 'user-1', token: 'jwt', expiresAt: '2026-01-01T00:00:00.000Z' }

  function refusing() {
    let notify: ((externalId: string) => void) | undefined
    const native = {
      loginWithToken: vi.fn().mockResolvedValue(undefined),
      loginWithoutToken: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn().mockResolvedValue(undefined),
      respondToJwtExpired: vi.fn().mockImplementation(async () => { notify?.('user-1') }),
      onJwtExpired: (h: (externalId: string) => void) => {
        notify = h
        return { remove: () => { notify = undefined } }
      },
    }
    return { native, expire: () => notify?.('user-1') }
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 40))

  it('spends again after the budget is reset — the dashboard fix case', async () => {
    const { native, expire } = refusing()
    const fetchToken = vi.fn().mockResolvedValue({ kind: 'ok' as const, token })
    const session = createIdentitySession({ native, fetchToken })

    session.start()
    expire()
    await settle()
    const exhausted = fetchToken.mock.calls.length
    expect(exhausted).toBe(MAX_CONSECUTIVE_JWT_REFRESHES)

    // Nothing more, however many times the SDK asks.
    expire()
    await settle()
    expect(fetchToken.mock.calls.length).toBe(exhausted)

    // The provider configuration is corrected and the app returns to the
    // foreground.
    session.resetRefreshBudget()
    expire()
    await settle()
    expect(fetchToken.mock.calls.length).toBeGreaterThan(exhausted)
  })

  it('recovers across logout then login as the same user', async () => {
    const { native, expire } = refusing()
    const fetchToken = vi.fn().mockResolvedValue({ kind: 'ok' as const, token })
    const session = createIdentitySession({ native, fetchToken })

    session.start()
    await session.apply({ kind: 'user', userId: 'user-1' })
    expire()
    await settle()
    const exhausted = fetchToken.mock.calls.length

    await session.apply(null)                                  // logout
    await session.apply({ kind: 'user', userId: 'user-1' })    // back in
    expire()
    await settle()

    expect(fetchToken.mock.calls.length).toBeGreaterThan(exhausted + 1)
  })

  it('a fresh start() also starts from a full budget', async () => {
    const { native, expire } = refusing()
    const fetchToken = vi.fn().mockResolvedValue({ kind: 'ok' as const, token })
    const session = createIdentitySession({ native, fetchToken })

    session.start()
    expire()
    await settle()
    const exhausted = fetchToken.mock.calls.length

    session.stop()
    session.start()
    expire()
    await settle()
    expect(fetchToken.mock.calls.length).toBeGreaterThan(exhausted)
  })
})

describe('ordered login: JWT -> confirmed identity -> eligible opt-in (#161)', () => {
  const token = { externalId: 'user-1', token: 'jwt', expiresAt: '2026-01-01T00:00:00.000Z' }

  function harness(overrides: Record<string, unknown> = {}) {
    const order: string[] = []
    const native = {
      loginWithToken: vi.fn(async () => { order.push('login') }),
      loginWithoutToken: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn(async () => { order.push('logout') }),
      respondToJwtExpired: vi.fn().mockResolvedValue(undefined),
      onJwtExpired: () => ({ remove: () => {} }),
    }
    const optIn = vi.fn(() => { order.push('optIn') })
    const confirmIdentity = vi.fn(async () => { order.push('confirm'); return { kind: 'confirmed' } })
    const eligible = vi.fn(async () => { order.push('eligible'); return true })
    const report = vi.fn()
    const session = createIdentitySession({
      native,
      fetchToken: vi.fn(async () => ({ kind: 'ok' as const, token })),
      confirmIdentity, eligible, optIn, report,
      ...overrides,
    })
    return { session, native, optIn, confirmIdentity, eligible, report, order }
  }

  it('opts in only after login and confirmation, in that order', async () => {
    const { session, order } = harness()
    await session.apply({ kind: 'user', userId: 'user-1' })
    await session.settled()
    expect(order).toEqual(['login', 'confirm', 'eligible', 'optIn'])
  })

  it('does not opt in when identity is never confirmed', async () => {
    // The refused-JWT shape. Opting in here is how a device ends up
    // subscribed while belonging to nobody the backend agrees with.
    const { session, optIn } = harness({
      confirmIdentity: vi.fn(async () => ({ kind: 'unconfirmed' })),
    })
    await session.apply({ kind: 'user', userId: 'user-1' })
    await session.settled()
    expect(optIn).not.toHaveBeenCalled()
  })

  it('does not opt in when the identity was superseded mid-confirmation', async () => {
    const { session, optIn } = harness({
      confirmIdentity: vi.fn(async () => ({ kind: 'superseded' })),
    })
    await session.apply({ kind: 'user', userId: 'user-1' })
    await session.settled()
    expect(optIn).not.toHaveBeenCalled()
  })

  it('respects a denied permission or a disabled preference', async () => {
    const { session, optIn, report } = harness({ eligible: vi.fn(async () => false) })
    await session.apply({ kind: 'user', userId: 'user-1' })
    await session.settled()
    expect(optIn).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledWith('push_resubscribe_not_eligible')
  })

  it('never opts in without both ports — fail closed', async () => {
    // A caller that has not wired permission and preference must not decide
    // someone is subscribed.
    const { session, optIn } = harness({ confirmIdentity: undefined })
    await session.apply({ kind: 'user', userId: 'user-1' })
    await session.settled()
    expect(optIn).not.toHaveBeenCalled()
  })

  it('an eligibility check that throws does not opt in', async () => {
    const { session, optIn } = harness({
      eligible: vi.fn(async () => { throw new Error('permission port gone') }),
    })
    await session.apply({ kind: 'user', userId: 'user-1' })
    await session.settled()
    expect(optIn).not.toHaveBeenCalled()
  })

  it("A's confirmation landing after B signs in does not opt in", async () => {
    // The isolation property, at the seam where it actually breaks: a slow
    // confirmation for A resolving once the session has moved to B.
    //
    // Each call gets its OWN gate. Sharing one promise would make the result
    // depend on microtask ordering between the two continuations rather than on
    // the supersede guard, and would pass even if the guard were deleted.
    const gates = new Map<string, (v: { kind: string }) => void>()
    const confirmIdentity = vi.fn(
      (externalId: string) =>
        new Promise<{ kind: string }>((resolve) => gates.set(externalId, resolve)),
    )
    const { session, optIn, report } = harness({ confirmIdentity })

    await session.apply({ kind: 'user', userId: 'user-1' })
    await session.apply({ kind: 'user', userId: 'user-2' })  // B takes over

    // B completes first and legitimately opts in.
    gates.get('user-2')!({ kind: 'confirmed' })
    await vi.waitFor(() => expect(optIn).toHaveBeenCalledTimes(1))

    // Only now does A's confirmation land — the case a generation guard on the
    // JS callback alone would not catch.
    gates.get('user-1')!({ kind: 'confirmed' })
    await session.settled()

    expect(optIn).toHaveBeenCalledTimes(1)  // still B's, and only B's
    expect(report).toHaveBeenCalledWith('push_resubscribe_superseded')
  })

  it('a confirmation that rejects reports failure and does not opt in', async () => {
    const { session, optIn, report } = harness({
      confirmIdentity: vi.fn(async () => {
        throw new Error('bridge gone')
      }),
    })
    await session.apply({ kind: 'user', userId: 'user-1' })
    await session.settled()

    expect(optIn).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledWith('push_resubscribe_failed')
  })

  it('logout during a pending confirmation leaves nobody opted in', async () => {
    // Terminate/relaunch and offline both reduce to this: the confirmation is
    // still in flight when the session ends.
    const gates = new Map<string, (v: { kind: string }) => void>()
    const confirmIdentity = vi.fn(
      (externalId: string) =>
        new Promise<{ kind: string }>((resolve) => gates.set(externalId, resolve)),
    )
    const { session, optIn, native } = harness({ confirmIdentity })

    await session.apply({ kind: 'user', userId: 'user-1' })
    await session.apply(null)
    gates.get('user-1')!({ kind: 'confirmed' })
    await session.settled()

    expect(native.logout).toHaveBeenCalled()
    expect(optIn).not.toHaveBeenCalled()
  })
})
