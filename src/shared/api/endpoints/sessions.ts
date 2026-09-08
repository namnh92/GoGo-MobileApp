import { api } from '../client'
import {
  clearSession,
  getSession,
  persistSession,
  sessionFromGrant,
  sessionFromGuestGrant,
  type Session,
} from '../session'
import type { OpBody, OpResponse } from '../types'

/**
 * Session endpoints own token persistence: a caller gets back the resulting
 * `Session`, and secure storage is already updated when the promise resolves.
 */

export async function register(body: OpBody<'register'>): Promise<Session> {
  const grant = await api.post<OpResponse<'register'>>('/auth/register', body, { anonymous: true })
  return persistSession(sessionFromGrant(grant, getSession()))
}

export async function login(body: OpBody<'login'>): Promise<Session> {
  const grant = await api.post<OpResponse<'login'>>('/auth/login', body, { anonymous: true })
  return persistSession(sessionFromGrant(grant))
}

/** Guest session by room share code (FR-AUTH-002) — no account, room-scoped. */
export async function createGuestSession(body: OpBody<'createGuestSession'>): Promise<Session> {
  const grant = await api.post<OpResponse<'createGuestSession'>>('/sessions/guest', body, { anonymous: true })
  return persistSession(sessionFromGuestGrant(grant))
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
export async function logout(allDevices = false): Promise<void> {
  await api.delete<OpResponse<'endCurrentSession'>>('/sessions/current', { allDevices })
  await clearSession()
}

export function getMe(): Promise<OpResponse<'getMe'>> {
  return api.get<OpResponse<'getMe'>>('/me')
}

export function updateProfile(body: OpBody<'updateProfile'>): Promise<OpResponse<'updateProfile'>> {
  return api.patch<OpResponse<'updateProfile'>>('/me', body)
}

export async function deleteAccount(): Promise<void> {
  await api.delete<OpResponse<'deleteAccount'>>('/me')
  await clearSession()
}

export function exportMyData(): Promise<OpResponse<'exportMyData'>> {
  return api.get<OpResponse<'exportMyData'>>('/me/export')
}
