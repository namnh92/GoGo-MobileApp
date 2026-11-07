import { api } from '../client'
import {
  clearSession,
  captureSessionScope,
  beginSessionEnd,
  getSession,
  persistSession,
  sessionFromGrant,
  sessionFromGuestGrant,
  type Session,
  type SessionScope,
} from '../session'
import type { OpBody, OpResponse } from '../types'

/**
 * Session endpoints own token persistence: a caller gets back the resulting
 * `Session`, and secure storage is already updated when the promise resolves.
 */

export async function register(body: OpBody<'register'>, scope: SessionScope = captureSessionScope()): Promise<Session> {
  scope.assert()
  const previous = getSession()
  const grant = await api.post<OpResponse<'register'>>('/auth/register', body, { anonymous: true, sessionGeneration: scope.generation })
  return persistSession(sessionFromGrant(grant, previous), scope.generation, true)
}

export async function login(body: OpBody<'login'>, scope: SessionScope = captureSessionScope()): Promise<Session> {
  scope.assert()
  const grant = await api.post<OpResponse<'login'>>('/auth/login', body, { anonymous: true, sessionGeneration: scope.generation })
  return persistSession(sessionFromGrant(grant), scope.generation, true)
}

/** Guest session by room share code (FR-AUTH-002) — no account, room-scoped. */
export async function createGuestSession(body: OpBody<'createGuestSession'>): Promise<Session> {
  const scope = captureSessionScope()
  const grant = await api.post<OpResponse<'createGuestSession'>>('/sessions/guest', body, { anonymous: true, sessionGeneration: scope.generation })
  return persistSession(sessionFromGuestGrant(grant), scope.generation, true)
}

/**
 * Revokes server-side, then wipes local credentials — in that order, and only
 * on success.
 *
 * The wipe used to run in a `finally`, on the reasoning that someone who taps
 * logout must not stay signed in. That is the wrong trade (NTF-APP-004 #160):
 * clearing regardless leaves a device the server still considers signed in,
 * and it destroys the session that confirming the push unsubscribe depends on.
 * A logout that did not happen must be reported as one that did not happen.
 */
export async function logout(allDevices = false, scope: SessionScope = beginSessionEnd()): Promise<void> {
  scope.assert()
  await api.delete<OpResponse<'endCurrentSession'>>('/sessions/current', { allDevices }, { sessionGeneration: scope.generation })
  await clearSession(false, scope.generation)
}

export function getMe(): Promise<OpResponse<'getMe'>> {
  return api.get<OpResponse<'getMe'>>('/me')
}

export function updateProfile(body: OpBody<'updateProfile'>): Promise<OpResponse<'updateProfile'>> {
  return api.patch<OpResponse<'updateProfile'>>('/me', body)
}

export async function deleteAccount(scope: SessionScope = beginSessionEnd()): Promise<void> {
  scope.assert()
  await api.delete<OpResponse<'deleteAccount'>>('/me', undefined, { sessionGeneration: scope.generation })
  await clearSession(false, scope.generation)
}

export function exportMyData(): Promise<OpResponse<'exportMyData'>> {
  return api.get<OpResponse<'exportMyData'>>('/me/export')
}
