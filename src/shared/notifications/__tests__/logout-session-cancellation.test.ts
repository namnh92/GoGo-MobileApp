import { afterEach, expect, it, vi } from 'vitest'

import { OneSignal } from 'react-native-onesignal'
import * as native from '../../../../modules/onesignal-identity'
import { beginSessionEnd, clearSession, getSession, persistSession, SessionCancelledError, type Session } from '@/shared/api/session'
import { createIdentitySession } from '../identity-session'
import { createLogoutConfirmation } from '../logout-confirmation'
import { confirmUnsubscribed, unsubscribeCurrentDeviceAndConfirm } from '../logout-confirmation-bootstrap'

vi.mock('react-native-onesignal', () => ({
  OneSignal: { User: { pushSubscription: { getIdAsync: vi.fn(async () => 'sub-A') } } },
}))
vi.mock('../../../../modules/onesignal-identity', () => ({
  loginWithToken: vi.fn(async () => {}),
  loginWithoutToken: vi.fn(async () => {}),
  logout: vi.fn(async () => {}),
  respondToJwtExpired: vi.fn(async () => {}),
  onJwtExpired: vi.fn(() => ({ remove: vi.fn() })),
}))

const A: Session = { kind: 'user', userId: 'A', accessToken: 'access-A', expiresAt: Date.now() + 600_000 }
const B: Session = { ...A, userId: 'B', accessToken: 'access-B' }
const json = (confirmed: boolean) => new Response(JSON.stringify({ confirmed }), { headers: { 'content-type': 'application/json' } })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
function coordinator(confirmSignOut = unsubscribeCurrentDeviceAndConfirm) {
  return createIdentitySession({
    native,
    fetchToken: async () => ({ kind: 'ok', token: { externalId: getSession()!.userId!, token: 'jwt', expiresAt: '' } }),
    confirmSignOut,
  })
}

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  await clearSession()
})

it('F-08: B cancels a queued A logout before it can read or unsubscribe B', async () => {
  await persistSession(A)
  const held = deferred<void>()
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(true))
  vi.mocked(native.loginWithToken).mockImplementationOnce(() => held.promise)
  const s = coordinator()
  const binding = s.apply(A)
  await vi.waitFor(() => expect(native.loginWithToken).toHaveBeenCalled())
  const scope = beginSessionEnd()
  const ending = s.beginSignOut('user', scope).catch(error => error)
  await persistSession(B)
  const boundB = s.apply(B)
  held.resolve()
  await Promise.all([binding, boundB])
  expect(await ending).toBeInstanceOf(SessionCancelledError)
  expect(OneSignal.User.pushSubscription.getIdAsync).not.toHaveBeenCalled()
  expect(native.logout).toHaveBeenCalledTimes(1) // The ordinary A → B transition still unregisters A.
  expect(s.boundUserId()).toBe('B')
})

it('F-08: a late subscription ID cannot log out B or send a confirmation as B', async () => {
  await persistSession(A)
  const id = deferred<string | null>()
  vi.mocked(OneSignal.User.pushSubscription.getIdAsync).mockImplementationOnce(() => id.promise)
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(true))
  const s = coordinator()
  await s.apply(A)
  const scope = beginSessionEnd()
  const ending = s.beginSignOut('user', scope).catch(error => error)
  await vi.waitFor(() => expect(OneSignal.User.pushSubscription.getIdAsync).toHaveBeenCalled())
  await persistSession(B)
  const boundB = s.apply(B)
  id.resolve('sub-A')
  await boundB
  expect(await ending).toBeInstanceOf(SessionCancelledError)
  await s.settled()
  expect(native.logout).toHaveBeenCalledTimes(1)
  expect(fetch).not.toHaveBeenCalled()
  expect(s.boundUserId()).toBe('B')
  expect(getSession()).toEqual(B)
})

it('F-08: cancels the polling timer and releases the queue without another confirmation', async () => {
  await persistSession(A)
  vi.useFakeTimers()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(false)).mockResolvedValue(json(true))
  const s = coordinator()
  await s.apply(A)
  const scope = beginSessionEnd()
  const ending = s.beginSignOut('user', scope).catch(error => error)
  await vi.waitFor(() => expect(vi.getTimerCount()).toBe(1))
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(new Headers(fetch.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer access-A')
  await persistSession(B)
  await s.apply(B)
  expect(await ending).toBeInstanceOf(SessionCancelledError)
  expect(vi.getTimerCount()).toBe(0)
  await vi.advanceTimersByTimeAsync(20_000)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(s.boundUserId()).toBe('B')
})

it('F-08: an in-flight confirmation is aborted and cancellation stays a session error', async () => {
  await persistSession(A)
  const reply = deferred<Response>()
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => reply.promise)
  const s = coordinator()
  await s.apply(A)
  const scope = beginSessionEnd()
  const ending = s.beginSignOut('user', scope).catch(error => error)
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  await persistSession(B)
  await s.apply(B)
  expect(await ending).toBeInstanceOf(SessionCancelledError)
  expect(fetch.mock.calls[0][1]?.signal?.aborted).toBe(true)
  reply.resolve(json(true))
  await s.settled()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(s.boundUserId()).toBe('B')
})

it('F-08: a resumed native logout cannot proceed to HTTP under B', async () => {
  await persistSession(A)
  const bridge = deferred<void>()
  vi.mocked(native.logout).mockImplementationOnce(() => bridge.promise)
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(true))
  const scope = beginSessionEnd()
  const ending = unsubscribeCurrentDeviceAndConfirm(scope).catch(error => error)
  await vi.waitFor(() => expect(native.logout).toHaveBeenCalled())
  await persistSession(B)
  bridge.resolve()
  expect(await ending).toBeInstanceOf(SessionCancelledError)
  expect(fetch).not.toHaveBeenCalled()
})

it('F-08: confirmation rejects the original generation before obtaining B credentials', async () => {
  await persistSession(A)
  const scope = beginSessionEnd()
  await persistSession(B)
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(true))
  await expect(confirmUnsubscribed('sub-A', scope)).rejects.toBeInstanceOf(SessionCancelledError)
  expect(fetch).not.toHaveBeenCalled()
})

it('F-08: cancelling an injected polling wait prevents its late continuation', async () => {
  await persistSession(A)
  const delay = deferred<void>()
  const sleep = vi.fn(() => delay.promise)
  const confirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true)
  const run = createLogoutConfirmation({ unsubscribe: native.logout, getSubscriptionId: async () => 'sub-A', confirm, sleep })
  const scope = beginSessionEnd()
  const ending = run(scope).catch(error => error)
  await vi.waitFor(() => expect(sleep).toHaveBeenCalled())
  await persistSession(B)
  expect(await ending).toBeInstanceOf(SessionCancelledError)
  delay.resolve()
  await Promise.resolve()
  expect(confirm).toHaveBeenCalledTimes(1)
})
