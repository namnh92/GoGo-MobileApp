import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { afterEach, expect, it, vi } from 'vitest'

import { currentAccessGrant, setOnSessionExpired } from '../client'
import { saveItem } from '../endpoints/me'
import {
  clearSession, getSession, getSessionGeneration, persistSession, subscribeToSession, type Session,
} from '../session'

const accountA: Session = {
  kind: 'user', userId: 'A', accessToken: 'access-A', refreshToken: 'refresh-A', expiresAt: 0,
}
const accountB: Session = {
  ...accountA, userId: 'B', accessToken: 'access-B', refreshToken: 'refresh-B', expiresAt: Date.now() + 600_000,
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
})
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}

afterEach(async () => {
  vi.restoreAllMocks()
  setOnSessionExpired(null)
  await clearSession()
})

async function expectStored(session: Session | null) {
  expect(await SecureStore.getItemAsync('gogo.access_token')).toBe(session?.accessToken ?? null)
  expect(await SecureStore.getItemAsync('gogo.refresh_token')).toBe(session?.refreshToken ?? null)
  expect(await SecureStore.getItemAsync('gogo.guest_token')).toBe(session?.guestToken ?? null)
  const meta = await SecureStore.getItemAsync('gogo.session_meta')
  expect(meta ? JSON.parse(meta).userId : null).toBe(session?.userId ?? null)
}

it.each([
  ['credentials', null], ['credentials', accountB],
  ['install marker', null], ['install marker', accountB],
] as const)(
  'rejects A refresh held at %s after transition to %j', async (stage, replacement) => {
    // Exercise both the saved-mutation waiter and the stream-token waiter.
    await persistSession(accountA)
    const generation = getSessionGeneration()
    const entered = deferred()
    const release = deferred()
    const write = SecureStore.setItemAsync
    const marker = AsyncStorage.setItem
    const hold = async () => { entered.resolve(); await release.promise }
    const spy = stage === 'credentials'
      ? vi.spyOn(SecureStore, 'setItemAsync').mockImplementation(async (key, value) => {
        if (key === 'gogo.access_token' && value === 'renewed-A') await hold()
        await write(key, value)
      })
      : vi.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, value) => {
        await hold()
        await marker(key, value)
      })
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({
      userId: 'A', accessToken: 'renewed-A', refreshToken: 'rotated-A', expiresIn: 900,
    }))
    const events: (Session | null)[] = []
    const unsubscribe = subscribeToSession(session => events.push(session))
    const mutation = saveItem('place', 'canonical', generation).then(() => null, error => error)
    const stream = currentAccessGrant().then(() => null, error => error)
    await entered.promise
    const transition = replacement ? persistSession(replacement) : clearSession()
    release.resolve()
    const [mutationError, streamError] = await Promise.all([mutation, stream, transition])
    unsubscribe()
    spy.mockRestore()
    expect(getSession()).toEqual(replacement)
    expect(mutationError).toMatchObject({ message: expect.stringContaining('Session changed') })
    expect(streamError).toMatchObject({ message: expect.stringContaining('Session changed') })
    expect(events.some(session => session?.accessToken === 'renewed-A')).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(1)
    await expectStored(replacement)
    fetch.mockRestore()
  },
)

it('does not let A refresh expiry clear B or notify B of expiry after a deferred delete', async () => {
  await persistSession(accountA)
  const entered = deferred()
  const release = deferred()
  const remove = SecureStore.deleteItemAsync
  vi.spyOn(SecureStore, 'deleteItemAsync').mockImplementation(async key => {
    if (key === 'gogo.access_token') { entered.resolve(); await release.promise }
    await remove(key)
  })
  const expired = vi.fn()
  setOnSessionExpired(expired)
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ code: 'SESSION_REVOKED' }, 401))
  const renewal = currentAccessGrant().then(() => null, error => error)
  await entered.promise
  const login = persistSession(accountB)
  release.resolve()
  const [error] = await Promise.all([renewal, login])
  expect(error).toMatchObject({ message: expect.stringContaining('Session changed') })
  expect(getSession()).toEqual(accountB)
  expect(expired).not.toHaveBeenCalled()
  await expectStored(accountB)
})

it('drains late writes after a partial storage failure before persisting B', async () => {
  await persistSession(accountA)
  const entered = deferred()
  const release = deferred()
  const write = SecureStore.setItemAsync
  const spy = vi.spyOn(SecureStore, 'setItemAsync').mockImplementation(async (key, value) => {
    if (value === 'renewed-A') { entered.resolve(); await release.promise }
    if (value === 'rotated-A') throw new Error('keychain unavailable')
    await write(key, value)
  })
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({
    userId: 'A', accessToken: 'renewed-A', refreshToken: 'rotated-A', expiresIn: 900,
  }))
  const renewal = currentAccessGrant().then(() => null, error => error)
  await entered.promise
  const login = persistSession(accountB)
  // Let rejected keys and the next queued operation run; the held native
  // access-token write must still prevent B's credential writes from starting.
  await new Promise<void>(resolve => setImmediate(resolve))
  const wroteBWhileAWasPending = spy.mock.calls.some(([, value]) => value === accountB.accessToken)
  release.resolve()
  const [error] = await Promise.all([renewal, login])
  expect(wroteBWhileAWasPending).toBe(false)
  expect(error).toMatchObject({ message: expect.stringContaining('Session changed') })
  expect(getSession()).toEqual(accountB)
  await expectStored(accountB)
})

it('rechecks the epoch after notifying subscribers before resuming refresh waiters', async () => {
  await persistSession(accountA)
  let logout: Promise<void> | undefined
  const unsubscribe = subscribeToSession(session => {
    if (session?.accessToken === 'renewed-A') logout = clearSession()
  })
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({
    userId: 'A', accessToken: 'renewed-A', refreshToken: 'rotated-A', expiresIn: 900,
  }))
  const result = await currentAccessGrant().then(() => null, error => error)
  unsubscribe()
  await logout
  expect(result).toMatchObject({ message: expect.stringContaining('Session changed') })
  expect(getSession()).toBeNull()
  await expectStored(null)
})

it('keeps B refresh single-flight when A network renewal settles late', async () => {
  await persistSession(accountA)
  const enteredA = deferred()
  const releaseA = deferred()
  const releaseB = deferred()
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
    const isA = JSON.parse(String(init?.body)).refreshToken === accountA.refreshToken
    if (isA) { enteredA.resolve(); await releaseA.promise }
    else await releaseB.promise
    return json({
      userId: isA ? 'A' : 'B', accessToken: isA ? 'renewed-A' : 'renewed-B',
      refreshToken: isA ? 'rotated-A' : 'rotated-B', expiresIn: 900,
    })
  })
  const oldRenewal = currentAccessGrant().then(() => null, error => error)
  await enteredA.promise
  await persistSession(accountB)
  const firstB = currentAccessGrant({ force: true }).catch(error => error)
  releaseA.resolve()
  const oldError = await oldRenewal
  const secondB = currentAccessGrant({ force: true }).catch(error => error)
  releaseB.resolve()
  const results = await Promise.all([firstB, secondB])
  expect(oldError).toMatchObject({ message: expect.stringContaining('Session changed') })
  for (const result of results) expect(result).toMatchObject({ token: 'renewed-B' })
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(getSession()).toMatchObject({ userId: 'B', accessToken: 'renewed-B' })
})

it.each(['install marker', 'credentials'] as const)(
  'does not restore A from startup hydration held at %s after B sign-in begins', async stage => {
    vi.resetModules()
    const fresh = await import('../session')
    const secure = await import('expo-secure-store')
    const storage = (await import('@react-native-async-storage/async-storage')).default
    await storage.setItem('gogo.install.v1', '1')
    await secure.setItemAsync('gogo.access_token', accountA.accessToken)
    await secure.setItemAsync('gogo.refresh_token', accountA.refreshToken!)
    await secure.setItemAsync('gogo.session_meta', JSON.stringify({
      kind: accountA.kind, userId: accountA.userId, expiresAt: accountA.expiresAt,
    }))
    const entered = deferred()
    const release = deferred()
    const readMarker = storage.getItem
    const read = secure.getItemAsync
    const spy = stage === 'install marker'
      ? vi.spyOn(storage, 'getItem').mockImplementation(async key => {
        const value = await readMarker(key)
        entered.resolve(); await release.promise
        return value
      })
      : vi.spyOn(secure, 'getItemAsync').mockImplementation(async key => {
        const value = await read(key)
        if (key === 'gogo.access_token') { entered.resolve(); await release.promise }
        return value
      })
    const events: (Session | null)[] = []
    const unsubscribe = fresh.subscribeToSession(session => events.push(session))
    const hydration = fresh.hydrateSession()
    await entered.promise
    const login = fresh.persistSession(accountB)
    release.resolve()
    await Promise.all([hydration, login])
    unsubscribe()
    spy.mockRestore()
    expect(events.some(session => session?.userId === 'A')).toBe(false)
    expect(fresh.getSession()).toEqual(accountB)
    expect(await secure.getItemAsync('gogo.access_token')).toBe(accountB.accessToken)
    expect(await secure.getItemAsync('gogo.refresh_token')).toBe(accountB.refreshToken)
    await fresh.clearSession()
  },
)
