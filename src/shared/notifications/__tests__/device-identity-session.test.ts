import { describe, expect, it, vi } from 'vitest'

import { createDeviceCredentialStore, type DeviceCredential } from '../device-credential-store'
import type { DeviceReportOutcome, DeviceRenewOutcome, DeviceRetireOutcome } from '../device-identity-api'
import {
  createDevicePromotionsStore,
  DEVICE_PROMOTIONS_DISCLOSURE,
  DEVICE_PROMOTIONS_STORAGE_KEY,
} from '../device-promotions-store'
import { createIdentitySession, type OneSignalIdentity } from '../identity-session'

/**
 * GoGo-MobileApp#398 — a device with no user session (shape D3, D5, D6, R-16,
 * R-17, R-17b, R-21). AC-12, AC-13, AC-16 live here; what a phone does is measured
 * on a phone.
 */

const OLD: DeviceCredential = { deviceId: 'old', deviceSecret: 'old-secret' }
const NEW: DeviceCredential = { deviceId: 'new', deviceSecret: 'new-secret' }

const accepted = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    disclosure: { id: DEVICE_PROMOTIONS_DISCLOSURE, answer: 'accepted', at: '2026-11-04T00:00:00.000Z' },
    enabled: true,
    version: 1,
    pendingVersion: null,
    awaitingProviderOff: false,
    ...over,
  })

function memoryKv(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    get: vi.fn(async (key: string) => data.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => void data.set(key, value)),
    remove: vi.fn(async (key: string) => void data.delete(key)),
    getItem: vi.fn(async (key: string) => data.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => void data.set(key, value)),
  }
}

function setup(options: {
  record?: string | null
  credential?: DeviceCredential
  retiring?: DeviceCredential[]
  nativeExternalId?: string | null
  renew?: (credential: DeviceCredential) => Promise<DeviceRenewOutcome>
  submit?: () => Promise<DeviceReportOutcome>
  retire?: () => Promise<DeviceRetireOutcome>
  eligible?: () => Promise<boolean>
  confirmIdentity?: () => Promise<{ kind: string }>
  fetchToken?: () => Promise<{ kind: 'ok'; token: { externalId: string; token: string; expiresAt: string } } | { kind: 'error' }>
} = {}) {
  const calls: string[] = []
  let expired: ((externalId: string) => void) | null = null
  const native: OneSignalIdentity & { fire(id: string): void } = {
    loginWithToken: vi.fn(async (id: string) => void calls.push(`login:${id}`)),
    loginWithoutToken: vi.fn(async () => {}),
    logout: vi.fn(async () => void calls.push('logout')),
    respondToJwtExpired: vi.fn(async (id: string) => void calls.push(`respond:${id}`)),
    onJwtExpired: vi.fn((handler: (id: string) => void) => {
      expired = handler
      return { remove: vi.fn() }
    }),
    fire: (id: string) => expired?.(id),
  }
  const secure = memoryKv({
    ...(options.credential ? { 'push.device': JSON.stringify(options.credential) } : {}),
    ...(options.retiring ? { 'push.device.retiring': JSON.stringify(options.retiring) } : {}),
  })
  const local = memoryKv(options.record ? { [DEVICE_PROMOTIONS_STORAGE_KEY]: options.record } : {})
  const promotions = createDevicePromotionsStore({ storage: local })
  const credentials = createDeviceCredentialStore(secure)
  const events: string[] = []
  const api = {
    create: vi.fn(async () => {
      calls.push('create')
      return {
        kind: 'ok' as const,
        credential: NEW,
        token: { externalId: 'device:new', token: 'jwt', expiresAt: '2026-11-04T01:00:00.000Z' },
      }
    }),
    renew: vi.fn(
      options.renew ??
        (async (credential: DeviceCredential): Promise<DeviceRenewOutcome> => {
          calls.push('renew')
          return {
            kind: 'ok',
            token: { externalId: `device:${credential.deviceId}`, token: 'jwt', expiresAt: '2026-11-04T01:00:00.000Z' },
          }
        }),
    ),
    submit: vi.fn(
      options.submit ??
        (async (_credential: DeviceCredential, body: { preferenceVersion: number; promotionsEnabled: boolean }): Promise<DeviceReportOutcome> => {
          calls.push(`report:${body.promotionsEnabled}:${body.preferenceVersion}`)
          return {
            kind: 'ok',
            result: { appliedVersion: body.preferenceVersion, storedVersion: body.preferenceVersion, providerEnabled: body.promotionsEnabled },
          }
        }),
    ),
    retire: vi.fn(
      async (credential: DeviceCredential): Promise<DeviceRetireOutcome> => {
        calls.push(`retire:${credential.deviceId}`)
        return options.retire ? options.retire() : { kind: 'done' }
      },
    ),
  }
  const session = createIdentitySession({
    native,
    fetchToken: options.fetchToken ?? (async () => ({ kind: 'ok', token: { externalId: 'A', token: 'jwt-a', expiresAt: '' } })),
    confirmIdentity: options.confirmIdentity ?? (async () => ({ kind: 'confirmed' })),
    eligible: options.eligible ?? (async () => true),
    optIn: () => void calls.push('optIn'),
    reportSubscription: async () => void calls.push('reportUser'),
    confirmSignOut: async () => void calls.push('confirm160'),
    report: e => events.push(e),
    device: {
      credentials,
      promotions,
      ...api,
      optOut: () => void calls.push('optOut'),
      getSubscriptionId: async () => 'sub-1',
      getNativeExternalId: async () => options.nativeExternalId ?? null,
      platform: 'ios',
      sleep: async () => {},
    },
  })
  return { session, native, calls, secure, local, promotions, credentials, api, events }
}

const USER = { kind: 'user' as const, userId: 'A' }

describe('step 0: the disclosure gates the identity (D6)', () => {
  it('no answer, nothing surviving: no identity, no native call', async () => {
    const t = setup()
    await t.session.apply(null)
    await t.session.settled()
    expect(t.calls).toEqual([])
    expect(t.session.boundDeviceId()).toBeNull()
  })

  it('a guest session is the same as no session', async () => {
    const t = setup({ record: accepted() })
    await t.session.apply({ kind: 'guest' })
    await t.session.settled()
    expect(t.calls).toEqual(['create', 'login:device:new', 'optIn', 'report:true:1'])
  })

  it('a stored answer the disk could not return retires nothing', async () => {
    const t = setup({ credential: OLD })
    t.local.getItem.mockRejectedValueOnce(new Error('disk'))
    await t.session.apply(null)
    await t.session.settled()
    expect(t.calls).toEqual([])
    expect(await t.credentials.read()).toEqual(OLD)
    expect(t.events).toContain('push_device_history_unreadable')
  })

  it('a record of older wording is no answer', async () => {
    const stale = JSON.stringify({ ...JSON.parse(accepted()), disclosure: { id: 'device-promotions-v0', answer: 'accepted', at: 'x' } })
    const t = setup({ record: stale })
    await t.session.apply(null)
    await t.session.settled()
    expect(t.api.create).not.toHaveBeenCalled()
  })
})

describe('bindDevice (D3)', () => {
  it('accepted: creates, stores, logs in, opts in, reports, in that order', async () => {
    const t = setup({ record: accepted() })
    await t.session.apply(null)
    await t.session.settled()
    expect(t.calls).toEqual(['create', 'login:device:new', 'optIn', 'report:true:1'])
    expect(await t.credentials.read()).toEqual(NEW)
    expect(t.session.boundDeviceId()).toBe('new')
  })

  it('a stored credential renews and creates nothing: cold start', async () => {
    const t = setup({ record: accepted(), credential: OLD })
    await t.session.apply(null)
    await t.session.settled()
    expect(t.calls).toEqual(['renew', 'login:device:old', 'optIn', 'report:true:1'])
  })

  it('switch off: opts out before the report, never opts in (M-3 d)', async () => {
    const t = setup({ record: accepted({ enabled: false, version: 2 }) })
    await t.session.apply(null)
    await t.session.settled()
    expect(t.calls).toEqual(['create', 'login:device:new', 'optOut', 'report:false:2'])
  })

  it('GONE on renewal: drops the credential and makes one new identity', async () => {
    const t = setup({ record: accepted(), credential: OLD, renew: async () => ({ kind: 'gone' }) })
    await t.session.apply(null)
    await t.session.settled()
    expect(t.calls).toEqual(['create', 'login:device:new', 'optIn', 'report:true:1'])
    expect(await t.credentials.read()).toEqual(NEW)
  })

  it('DISABLED: leaves the provider, drops the credential, no recreate until the next launch', async () => {
    const t = setup({
      record: accepted(),
      credential: OLD,
      nativeExternalId: 'device:old',
      renew: async () => ({ kind: 'disabled' }),
    })
    await t.session.apply(null)
    await t.session.settled()
    expect(t.calls).toEqual(['logout'])
    expect(await t.credentials.read()).toBeNull()
    expect(t.promotions.snapshot().serviceOff).toBe(true)

    await t.session.retryPending()
    expect(t.api.create).not.toHaveBeenCalled()
  })

  it('401 on renewal is a client bug: the credential stays, nothing is recreated', async () => {
    const t = setup({ record: accepted(), credential: OLD, renew: async () => ({ kind: 'malformed' }) })
    await t.session.apply(null)
    await t.session.settled()
    expect(t.api.create).not.toHaveBeenCalled()
    expect(await t.credentials.read()).toEqual(OLD)
    expect(t.events).toContain('push_device_credential_malformed')
  })

  it('GONE on a report: a bound device recreates, it does not stay a no-op', async () => {
    let first = true
    const t = setup({
      record: accepted(),
      credential: OLD,
      submit: async () => {
        if (first) {
          first = false
          return { kind: 'gone' }
        }
        return { kind: 'ok', result: { appliedVersion: 1, storedVersion: 1, providerEnabled: true } }
      },
    })
    await t.session.apply(null)
    await t.session.settled()
    await vi.waitFor(() => expect(t.session.boundDeviceId()).toBe('new'))
    await t.session.settled()
    expect(t.api.create).toHaveBeenCalledTimes(1)
  })

  it('offline: stays pending and binds on the next trigger (AC-8)', async () => {
    const t = setup({ record: accepted() })
    t.api.create.mockResolvedValueOnce({ kind: 'error' } as never)
    await t.session.apply(null)
    await t.session.settled()
    expect(t.events).toContain('signed_out_device_bind_pending')
    expect(t.session.boundDeviceId()).toBeNull()

    await t.session.retryPending()
    await t.session.settled()
    expect(t.session.boundDeviceId()).toBe('new')
  })

  it('OS permission off: reports nothing the server would refuse, and tries again on the trigger', async () => {
    let allowed = false
    const t = setup({ record: accepted(), eligible: async () => allowed })
    await t.session.apply(null)
    await t.session.settled()
    expect(t.api.submit).not.toHaveBeenCalled()

    allowed = true
    await t.session.retryPending()
    await t.session.settled()
    expect(t.api.submit).toHaveBeenCalledTimes(1)
  })

  it('409 stale: goes past the stored version', async () => {
    let first = true
    const versions: number[] = []
    const t = setup({
      record: accepted({ version: 3, pendingVersion: 3 }),
      submit: vi.fn(async (...args: unknown[]) => {
        versions.push((args[1] as { preferenceVersion: number }).preferenceVersion)
        if (first) {
          first = false
          return { kind: 'stale' as const, storedVersion: 7 }
        }
        return { kind: 'ok' as const, result: { appliedVersion: 8, storedVersion: 8, providerEnabled: true } }
      }) as never,
    })
    await t.session.apply(null)
    await t.session.settled()
    expect(versions).toEqual([3, 8])
    expect(t.promotions.snapshot()).toMatchObject({ version: 8, pendingVersion: null })
  })

  it('a conflict reports again, at most twice, then waits for a trigger', async () => {
    const t = setup({ record: accepted(), submit: async () => ({ kind: 'conflict' }) })
    await t.session.apply(null)
    await t.session.settled()
    expect(t.api.submit).toHaveBeenCalledTimes(3)
    expect(t.events).toContain('push_device_report_failed')
  })

  it('an overtaken bind leaves its credential to be retired, not orphaned', async () => {
    const t = setup({ record: accepted() })
    let release!: () => void
    t.api.create.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => {
        release = resolve
      })
      return { kind: 'ok', credential: NEW, token: { externalId: 'device:new', token: 'jwt', expiresAt: '' } }
    })
    const binding = t.session.apply(null)
    await vi.waitFor(() => expect(t.api.create).toHaveBeenCalled())
    const signingIn = t.session.apply(USER)
    release()
    await Promise.all([binding, signingIn])
    await t.session.settled()

    expect(t.calls).not.toContain('login:device:new')
    expect(t.calls).toContain('retire:new')
    expect(await t.credentials.read()).toBeNull()
    expect(t.session.boundUserId()).toBe('A')
  })
})

describe('transitions between identities (D3)', () => {
  it('sign-in from a device: retire, log out, bind the user, in that order', async () => {
    const t = setup({ record: accepted() })
    await t.session.apply(null)
    await t.session.settled()
    t.calls.length = 0

    await t.session.apply(USER)
    await t.session.settled()
    expect(t.calls).toEqual(['retire:new', 'logout', 'login:A', 'optIn', 'reportUser'])
    expect(await t.credentials.read()).toBeNull()
    expect(await t.credentials.retiring()).toEqual([])
  })

  it('a failed DELETE does not hold the sign-in up, and stays queued for retirement', async () => {
    const t = setup({ record: accepted(), credential: OLD, retire: async () => ({ kind: 'error' }) })
    await t.session.apply(USER)
    await t.session.settled()
    expect(t.session.boundUserId()).toBe('A')
    expect(await t.credentials.retiring()).toEqual([OLD])
    expect(await t.credentials.read()).toBeNull()
  })

  it('session expiry with no #160: logs the user out, then binds the device', async () => {
    const t = setup({ record: accepted() })
    await t.session.apply(USER)
    await t.session.settled()
    t.calls.length = 0
    await t.session.apply(null)
    await t.session.settled()
    expect(t.calls).toEqual(['logout', 'create', 'login:device:new', 'optIn', 'report:true:1'])
  })

  it('a device identity is fresh after every sign-out', async () => {
    const t = setup({ record: accepted() })
    await t.session.apply(null)
    await t.session.settled()
    await t.session.apply(USER)
    await t.session.settled()
    await t.session.beginSignOut('user')
    await t.session.apply(null)
    await t.session.settled()
    expect(t.api.create).toHaveBeenCalledTimes(2)
    expect(t.api.renew).not.toHaveBeenCalled()
  })

  it('a session refresh of the same user changes nothing', async () => {
    const t = setup({ record: accepted() })
    await t.session.apply(USER)
    await t.session.settled()
    t.calls.length = 0
    await t.session.apply(USER)
    await t.session.settled()
    expect(t.calls).toEqual([])
  })

  it('the queue waits for the SDK to finish a login before the next transition (§8.1)', async () => {
    const order: string[] = []
    let finishSdk!: () => void
    const native: OneSignalIdentity = {
      loginWithToken: vi.fn(async () => void order.push('login')),
      loginWithoutToken: vi.fn(async () => {}),
      logout: vi.fn(async () => void order.push('logout')),
      respondToJwtExpired: vi.fn(async () => {}),
      onJwtExpired: vi.fn(() => ({ remove: vi.fn() })),
    }
    const s = createIdentitySession({
      native,
      fetchToken: async () => ({ kind: 'ok', token: { externalId: 'A', token: 'jwt', expiresAt: '' } }),
      settleNative: () =>
        new Promise<void>(resolve => {
          finishSdk = () => {
            order.push('settled')
            resolve()
          }
        }),
    })
    const signingIn = s.apply(USER)
    await vi.waitFor(() => expect(order).toEqual(['login']))
    const signingOut = s.apply(null)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(order).toEqual(['login'])

    finishSdk()
    await Promise.all([signingIn, signingOut])
    expect(order).toEqual(['login', 'settled', 'logout'])
  })
})

describe('sign-out (AC-16, R-21)', () => {
  async function signedIn(options: Parameters<typeof setup>[0] = {}) {
    const t = setup({ record: accepted(), ...options })
    t.session.start()
    await t.session.apply(USER)
    await t.session.settled()
    t.calls.length = 0
    return t
  }

  it('#160 runs inside the transition, and a confirmed sign-out ends on a device identity', async () => {
    const t = await signedIn()
    await t.session.beginSignOut('user')
    await t.session.apply(null)
    await t.session.settled()
    expect(t.calls).toEqual(['confirm160', 'create', 'login:device:new', 'optIn', 'report:true:1'])
  })

  it('a same-user emission during #160 does not bind the user again', async () => {
    const t = await signedIn()
    const ending = t.session.beginSignOut('user')
    await t.session.apply(USER)
    await ending
    await t.session.settled()
    expect(t.calls).toEqual(['confirm160'])
  })

  it('an expiry callback across #160 performs no native mutation', async () => {
    const t = await signedIn()
    const ending = t.session.beginSignOut('user')
    t.native.fire('A')
    await ending
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(t.calls).toEqual(['confirm160'])
    expect(t.events).toContain('push_identity_refresh_superseded')
  })

  it('a refresh that began before #160 and answers after it is dropped', async () => {
    let release!: () => void
    const slow = new Promise<{ kind: 'ok'; token: { externalId: string; token: string; expiresAt: string } }>(resolve => {
      release = () => resolve({ kind: 'ok', token: { externalId: 'A', token: 'late', expiresAt: '' } })
    })
    const fetches = [Promise.resolve({ kind: 'ok' as const, token: { externalId: 'A', token: 'jwt-a', expiresAt: '' } }), slow]
    const t = await signedIn({ fetchToken: () => fetches.shift()! })

    t.native.fire('A')
    await t.session.beginSignOut('user')
    release()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(t.native.respondToJwtExpired).not.toHaveBeenCalled()
  })

  it('a failed confirmation rejects, and cancelling binds the same user again', async () => {
    const t = setup({ record: accepted() })
    const confirm = vi.fn(async () => {
      throw new Error('not confirmed')
    })
    const s = createIdentitySession({
      native: t.native,
      fetchToken: async () => ({ kind: 'ok', token: { externalId: 'A', token: 'jwt', expiresAt: '' } }),
      confirmSignOut: confirm,
    })
    await s.apply(USER)
    await expect(s.beginSignOut('user')).rejects.toThrow('not confirmed')
    expect(s.boundUserId()).toBeNull()

    await s.cancelSignOut()
    expect(s.boundUserId()).toBe('A')
    expect(t.native.loginWithToken).toHaveBeenCalledTimes(2)
  })

  it('a guest leaves with no confirmation and keeps the device identity (#279)', async () => {
    const t = setup({ record: accepted() })
    await t.session.apply({ kind: 'guest' })
    await t.session.settled()
    t.calls.length = 0
    await t.session.beginSignOut('guest')
    await t.session.apply(null)
    await t.session.settled()
    expect(t.calls).toEqual([])
    expect(t.session.boundDeviceId()).toBe('new')
  })
})

describe('missing or declined disclosure with surviving state (AC-13, R-17, R-17b)', () => {
  it('quarantines first, opts out and logs out, and clears only on 2xx', async () => {
    const order: string[] = []
    const t = setup({ credential: OLD, retire: async () => ({ kind: 'done' }) })
    t.secure.set.mockImplementation(async (key: string, value: string) => {
      if (key === 'push.device.retiring') order.push('quarantined')
      t.secure.data.set(key, value)
    })
    t.native.logout = vi.fn(async () => void order.push('logout'))
    await t.session.apply(null)
    await t.session.settled()
    expect(order).toEqual(['quarantined', 'logout'])
    expect(t.calls).toEqual(['optOut', 'retire:old'])
    expect(await t.credentials.retiring()).toEqual([])
    expect(t.api.create).not.toHaveBeenCalled()
    expect(t.api.renew).not.toHaveBeenCalled()
  })

  it('a failed DELETE keeps the credential across a restart, and later clears on GONE-as-done', async () => {
    const t = setup({ credential: OLD, retire: async () => ({ kind: 'error' }) })
    await t.session.apply(null)
    await t.session.settled()
    expect(await t.credentials.retiring()).toEqual([OLD])
    expect(await t.credentials.read()).toBeNull()

    const restarted = setup({ retiring: [OLD], retire: async () => ({ kind: 'done' }) })
    await restarted.session.apply(null)
    await restarted.session.settled()
    expect(restarted.calls).toEqual(['retire:old'])
    expect(await restarted.credentials.retiring()).toEqual([])
  })

  it('accepting later does not restore the quarantined identity, and retirement carries on', async () => {
    const results: DeviceRetireOutcome[] = [{ kind: 'error' }, { kind: 'done' }]
    const t = setup({ credential: OLD, retire: async () => results.shift()! })
    await t.session.apply(null)
    await t.session.settled()
    await t.session.answerDisclosure('accepted')
    await t.session.settled()

    expect(t.calls).toContain('retire:old')
    expect(t.calls).not.toContain('login:device:old')
    expect(t.api.renew).not.toHaveBeenCalled()
    expect(await t.credentials.read()).toEqual(NEW)
    expect(await t.credentials.retiring()).toEqual([])
  })

  it('a decline does not stop retirement', async () => {
    const results: DeviceRetireOutcome[] = [{ kind: 'error' }, { kind: 'done' }]
    const t = setup({ credential: OLD, retire: async () => results.shift()! })
    await t.session.apply(null)
    await t.session.settled()
    await t.session.answerDisclosure('declined')
    await t.session.settled()
    expect(await t.credentials.retiring()).toEqual([])
    expect(t.api.create).not.toHaveBeenCalled()
  })

  it('a live binding is not a no-op once the answer changes to decline', async () => {
    const t = setup({ record: accepted() })
    await t.session.apply(null)
    await t.session.settled()
    t.calls.length = 0
    await t.session.answerDisclosure('declined')
    await t.session.settled()
    expect(t.calls).toEqual(['optOut', 'logout', 'retire:new'])
    expect(t.session.boundDeviceId()).toBeNull()
  })

  it('lost history with only a native identity left: neutralised, nothing to retire', async () => {
    const t = setup({ nativeExternalId: 'device:gone-from-keychain' })
    await t.session.apply(null)
    await t.session.settled()
    expect(t.calls).toEqual(['optOut', 'logout'])
  })

  it('the retry budget does not depend on the answer: foreground resumes it', async () => {
    const results: DeviceRetireOutcome[] = [{ kind: 'error' }, { kind: 'done' }]
    const t = setup({ credential: OLD, retire: async () => results.shift()! })
    await t.session.apply(null)
    await t.session.settled()
    await t.session.retryPending()
    await t.session.settled()
    expect(await t.credentials.retiring()).toEqual([])
  })
})

describe('promotions switch converges on the provider (AC-12, R-16)', () => {
  it('off survives a providerEnabled=true ack and a restart; only false for this version clears it', async () => {
    const record = accepted({ enabled: false, version: 8, pendingVersion: 8, awaitingProviderOff: true })
    const answers: DeviceReportOutcome[] = [
      { kind: 'ok', result: { appliedVersion: 8, storedVersion: 8, providerEnabled: true } },
      { kind: 'ok', result: { appliedVersion: 8, storedVersion: 8, providerEnabled: true } },
      { kind: 'ok', result: { appliedVersion: 8, storedVersion: 8, providerEnabled: true } },
      { kind: 'ok', result: { appliedVersion: 8, storedVersion: 8, providerEnabled: true } },
      { kind: 'ok', result: { appliedVersion: 8, storedVersion: 8, providerEnabled: false } },
    ]
    const t = setup({ record, submit: async () => answers.shift()! })
    await t.session.apply(null)
    await t.session.settled()
    expect(t.promotions.snapshot()).toMatchObject({ pendingVersion: null, awaitingProviderOff: true })
    expect(JSON.parse(t.local.data.get(DEVICE_PROMOTIONS_STORAGE_KEY)!).awaitingProviderOff).toBe(true)

    await t.session.retryPending()
    await t.session.settled()
    expect(t.promotions.snapshot().awaitingProviderOff).toBe(false)
    expect(answers).toHaveLength(0)
  })

  it('a delayed response for v8 clears nothing of v9', async () => {
    let answerOld!: (value: DeviceReportOutcome) => void
    const reports: number[] = []
    const t = setup({
      record: accepted({ enabled: false, version: 8, pendingVersion: 8, awaitingProviderOff: true }),
      submit: vi.fn(async (...args: unknown[]) => {
        const version = (args[1] as { preferenceVersion: number }).preferenceVersion
        reports.push(version)
        if (version === 8) return new Promise<DeviceReportOutcome>(resolve => (answerOld = resolve))
        return { kind: 'ok' as const, result: { appliedVersion: version, storedVersion: version, providerEnabled: true } }
      }) as never,
    })
    await t.session.apply(null)
    await vi.waitFor(() => expect(reports).toEqual([8]))

    await t.session.setPromotions(true)
    await vi.waitFor(() => expect(reports).toEqual([8, 9]))
    answerOld({ kind: 'ok', result: { appliedVersion: 8, storedVersion: 8, providerEnabled: false } })
    await t.session.settled()

    expect(t.promotions.snapshot()).toMatchObject({ enabled: true, version: 9, pendingVersion: null })
  })

  it('the store: an older ack clears nothing', () => {
    const local = memoryKv()
    const store = createDevicePromotionsStore({ storage: local })
    store.answer('accepted')
    store.setEnabled(false)
    store.setEnabled(true)
    store.setEnabled(false)
    expect(store.snapshot()).toMatchObject({ version: 4, pendingVersion: 4, awaitingProviderOff: true })

    store.acknowledge({ appliedVersion: 3, providerEnabled: false })
    expect(store.snapshot()).toMatchObject({ pendingVersion: 4, awaitingProviderOff: true })

    store.acknowledge({ appliedVersion: 4, providerEnabled: true })
    expect(store.snapshot()).toMatchObject({ pendingVersion: null, awaitingProviderOff: true })

    store.acknowledge({ appliedVersion: 4, providerEnabled: false })
    expect(store.snapshot()).toMatchObject({ pendingVersion: null, awaitingProviderOff: false })
  })

  it('a change made offline replays on the next trigger (AC-7)', async () => {
    const answers: DeviceReportOutcome[] = [{ kind: 'ok', result: { appliedVersion: 1, storedVersion: 1, providerEnabled: true } }]
    const t = setup({
      record: accepted(),
      submit: async () => answers.shift() ?? { kind: 'error' },
    })
    await t.session.apply(null)
    await t.session.settled()
    await t.session.setPromotions(false)
    await t.session.settled()
    expect(t.promotions.snapshot()).toMatchObject({ enabled: false, pendingVersion: 2 })
    expect(t.events).toContain('push_device_report_failed')

    answers.push({ kind: 'ok', result: { appliedVersion: 2, storedVersion: 2, providerEnabled: false } })
    await t.session.retryPending()
    await t.session.settled()
    expect(t.promotions.snapshot()).toMatchObject({ pendingVersion: null, awaitingProviderOff: false })
  })

  it('turning on from a decline records the answer and binds', async () => {
    const t = setup({ record: JSON.stringify({ ...JSON.parse(accepted({ enabled: false })), disclosure: { id: DEVICE_PROMOTIONS_DISCLOSURE, answer: 'declined', at: 'x' } }) })
    await t.session.apply(null)
    await t.session.settled()
    expect(t.api.create).not.toHaveBeenCalled()

    await t.session.setPromotions(true)
    await t.session.settled()
    expect(t.promotions.snapshot()).toMatchObject({ answer: 'accepted', enabled: true })
    expect(t.session.boundDeviceId()).toBe('new')
  })

  it('a change while signed in is stored and touches no identity', async () => {
    const t = setup({ record: accepted() })
    await t.session.apply(USER)
    await t.session.settled()
    t.calls.length = 0
    await t.session.setPromotions(false)
    await t.session.settled()
    expect(t.calls).toEqual([])
    expect(t.promotions.snapshot().enabled).toBe(false)
  })
})

describe('token expiry of a device identity', () => {
  it('renews on the device route and answers the SDK', async () => {
    const t = setup({ record: accepted(), credential: OLD })
    t.session.start()
    await t.session.apply(null)
    await t.session.settled()
    t.api.renew.mockClear()
    t.native.fire('device:old')
    await vi.waitFor(() => expect(t.native.respondToJwtExpired).toHaveBeenCalledWith('device:old', 'jwt'))
    expect(t.api.renew).toHaveBeenCalledTimes(1)
  })

  it('ignores a callback for an identity already left', async () => {
    const t = setup({ record: accepted() })
    t.session.start()
    await t.session.apply(USER)
    await t.session.settled()
    t.native.fire('device:old')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(t.native.respondToJwtExpired).not.toHaveBeenCalled()
  })

  it('GONE on a token refresh recreates', async () => {
    const results: DeviceRenewOutcome[] = [
      { kind: 'ok', token: { externalId: 'device:old', token: 'jwt', expiresAt: '' } },
      { kind: 'gone' },
    ]
    const t = setup({ record: accepted(), credential: OLD, renew: async () => results.shift()! })
    t.session.start()
    await t.session.apply(null)
    await t.session.settled()
    t.native.fire('device:old')
    await vi.waitFor(() => expect(t.session.boundDeviceId()).toBe('new'))
  })
})

describe('logs (D7)', () => {
  it('no reason code carries a credential, a device id or a subscription id', async () => {
    const t = setup({ record: accepted(), credential: OLD })
    await t.session.apply(null)
    await t.session.settled()
    await t.session.apply(USER)
    await t.session.settled()
    for (const event of t.events) expect(event).toMatch(/^[a-z_0-9]+$/)
  })
})
