import * as SecureStore from 'expo-secure-store'
import { afterEach, expect, it, vi } from 'vitest'

import { api, conditionalGet, currentAccessGrant } from '../client'
import * as auth from '../endpoints/sessions'
import { joinRoomAsGuest } from '../endpoints/rooms'
import { putPresigned } from '../endpoints/uploads'
import { clearSession, getSession, persistSession, type Session } from '../session'

const A: Session = { kind: 'user', userId: 'A', accessToken: 'access-A', refreshToken: 'refresh-A', expiresAt: Date.now() + 600_000 }
const B: Session = { ...A, userId: 'B', accessToken: 'access-B', refreshToken: 'refresh-B' }
const guest: Session = { kind: 'guest', roomId: 'room-A', accessToken: 'guest-A', guestToken: 'opaque-A', expiresAt: A.expiresAt }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
afterEach(async () => { vi.restoreAllMocks(); await clearSession() })

it.each(['logout', 'switch', 'guest claim', 'same user relogin'] as const)('aborts all A requests on %s and ignores late success/401', async transition => {
  await persistSession(transition === 'guest claim' ? guest : A)
  const replies = [deferred<Response>(), deferred<Response>()]
  const fetch = vi.spyOn(globalThis, 'fetch')
    .mockImplementationOnce(() => replies[0].promise)
    .mockImplementationOnce(() => replies[1].promise)
    .mockResolvedValue(json({}))
  const first = api.get('/me').catch(error => error)
  const second = api.post('/rooms', {}).catch(error => error)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  if (transition === 'logout' || transition === 'same user relogin') await clearSession()
  if (transition !== 'logout') await persistSession(transition === 'same user relogin' ? A : B)
  const signals = fetch.mock.calls.slice(0, 2).map(([, init]) => init?.signal?.aborted)
  replies[0].resolve(json({ private: 'A' }))
  replies[1].resolve(json({ code: 'UNAUTHORIZED' }, 401))
  const results = await Promise.all([first, second])
  expect(signals).toEqual([true, true])
  for (const result of results) expect(result).toMatchObject({ message: expect.stringContaining('Session changed') })
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(getSession()).toEqual(transition === 'logout' ? null : transition === 'same user relogin' ? A : B)
})

it.each([
  ['login', () => auth.login({} as never)],
  ['register', () => auth.register({} as never)],
  ['guest', () => auth.createGuestSession({} as never)],
  ['guest join', () => joinRoomAsGuest({} as never)],
  ['logout', () => auth.logout()],
  ['delete account', () => auth.deleteAccount()],
] as const)('F-05: late A %s cannot persist or clear B', async (_label, run) => {
  await persistSession(A)
  const reply = deferred<Response>()
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => reply.promise)
  const result = run().catch(error => error)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  await persistSession(B)
  reply.resolve(json({ userId: 'A', accessToken: 'late-A', refreshToken: 'late-refresh-A', expiresIn: 900, roomId: 'room-A', guestToken: 'late-guest-A' }))
  expect(await result).toMatchObject({ message: expect.stringContaining('Session changed') })
  expect(getSession()).toEqual(B)
  expect(await SecureStore.getItemAsync('gogo.access_token')).toBe(B.accessToken)
  expect(await SecureStore.getItemAsync('gogo.refresh_token')).toBe(B.refreshToken)
})

it('cancels guest-join cleanup held across B login before it can persist', async () => {
  await persistSession(A)
  const entered = deferred<void>()
  const release = deferred<void>()
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ accessToken: 'late-guest', roomId: 'room-A' }))
  const result = joinRoomAsGuest({} as never, async () => { entered.resolve(); await release.promise }).catch(error => error)
  await entered.promise
  await persistSession(B)
  release.resolve()
  expect(await result).toMatchObject({ message: expect.stringContaining('Session changed') })
  expect(getSession()).toEqual(B)
})

it.each([200, 401])('aborts single-flight refresh and drops its late %s response', async status => {
  await persistSession({ ...A, expiresAt: 0 })
  const reply = deferred<Response>()
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => reply.promise)
  const first = currentAccessGrant().catch(error => error)
  const second = api.get('/me').catch(error => error)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  await persistSession(B)
  const aborted = fetch.mock.calls[0][1]?.signal?.aborted
  reply.resolve(json({ accessToken: 'late-A', refreshToken: 'late-refresh-A', userId: 'A', expiresIn: 900 }, status))
  await Promise.all([first, second])
  expect(aborted).toBe(true)
  expect(getSession()).toEqual(B)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('rejects a response body that finishes after a session switch', async () => {
  await persistSession(A)
  const body = deferred<string>()
  const entered = deferred<void>()
  const response = json({})
  vi.spyOn(response, 'text').mockImplementation(() => { entered.resolve(); return body.promise })
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)
  const result = api.get('/me').catch(error => error)
  await entered.promise
  await persistSession(B)
  expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true)
  body.resolve('{"private":"A"}')
  expect(await result).toMatchObject({ message: expect.stringContaining('Session changed') })
})

it('never sends a request with an already-aborted caller signal', async () => {
  await persistSession(A)
  const controller = new AbortController()
  controller.abort()
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({}))
  await expect(api.get('/me', { signal: controller.signal })).rejects.toBeDefined()
  expect(fetch).not.toHaveBeenCalled()
})

it('also aborts anonymous conditional reads when their issuing epoch ends', async () => {
  await persistSession(A)
  const reply = deferred<Response>()
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => reply.promise)
  const result = conditionalGet('/taxonomies').catch(error => error)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  await clearSession()
  const aborted = fetch.mock.calls[0][1]?.signal?.aborted
  reply.resolve(json({ stale: true }))
  expect(await result).toMatchObject({ message: expect.stringContaining('Session changed') })
  expect(aborted).toBe(true)
})

it('cancels existing requests as soon as logout starts, before server revocation completes', async () => {
  await persistSession(A)
  const reply = deferred<Response>()
  const revoke = deferred<Response>()
  const fetch = vi.spyOn(globalThis, 'fetch')
    .mockImplementationOnce(() => reply.promise)
    .mockImplementationOnce(() => revoke.promise)
  const old = api.get('/me').catch(error => error)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  const logout = auth.logout().catch(error => error)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
  const aborted = fetch.mock.calls[0][1]?.signal?.aborted
  revoke.resolve(new Response(null, { status: 204 }))
  reply.resolve(json({ id: 'A' }))
  await logout
  expect(aborted).toBe(true)
  expect(await old).toMatchObject({ message: expect.stringContaining('Session changed') })
  expect(getSession()).toBeNull()
})

it('session expiry aborts other requests and rejects a late private response', async () => {
  await persistSession(A)
  const reply = deferred<Response>()
  const fetch = vi.spyOn(globalThis, 'fetch')
    .mockImplementationOnce(() => reply.promise)
    .mockResolvedValue(json({ code: 'SESSION_REVOKED' }, 401))
  const old = api.get('/me').catch(error => error)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  await currentAccessGrant({ force: true })
  const aborted = fetch.mock.calls[0][1]?.signal?.aborted
  reply.resolve(json({ private: 'A' }))
  expect(aborted).toBe(true)
  expect(await old).toMatchObject({ message: expect.stringContaining('Session changed') })
  expect(getSession()).toBeNull()
})

it('a new login by the same user cancels the previous lifetime while refresh preserves it', async () => {
  await persistSession(A)
  const reply = deferred<Response>()
  const fetch = vi.spyOn(globalThis, 'fetch')
    .mockImplementationOnce(() => reply.promise)
    .mockResolvedValue(json({ userId: 'A', accessToken: 'new-login-A', refreshToken: 'new-refresh-A', expiresIn: 900 }))
  const old = api.get('/me').catch(error => error)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  await auth.login({} as never)
  const aborted = fetch.mock.calls[0][1]?.signal?.aborted
  reply.resolve(json({ private: 'old-A' }))
  expect(aborted).toBe(true)
  expect(await old).toMatchObject({ message: expect.stringContaining('Session changed') })
})

it('aborts a presigned upload and rejects its late completion on account switch', async () => {
  await persistSession(A)
  const reply = deferred<Response>()
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => reply.promise)
  const upload = putPresigned('https://storage.invalid/upload', new Blob(['bytes']), 'image/jpeg').catch(error => error)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  await persistSession(B)
  const aborted = fetch.mock.calls[0][1]?.signal?.aborted
  reply.resolve(new Response(null, { status: 200 }))
  expect(await upload).toMatchObject({ message: expect.stringContaining('Session changed') })
  expect(aborted).toBe(true)
})

it('does not adopt an account transition started synchronously by an abort listener', async () => {
  await persistSession(A)
  const reply = deferred<Response>()
  let reentrant: Promise<Session> | undefined
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
    init?.signal?.addEventListener('abort', () => { reentrant = persistSession(B) }, { once: true })
    return reply.promise
  })
  const old = api.get('/me').catch(error => error)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  const superseded = persistSession({ ...A, userId: 'C', accessToken: 'C' }).catch(error => error)
  await reentrant
  reply.resolve(json({ id: 'A' }))
  await old
  expect(await superseded).toMatchObject({ message: expect.stringContaining('Session changed') })
  expect(getSession()).toEqual(B)
})
