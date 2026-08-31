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
 * Revokes server-side, then wipes local credentials. The local wipe runs even
 * if the network call fails — a user who taps logout must not stay signed in.
 */
export async function logout(allDevices = false): Promise<void> {
  try {
    await api.delete<OpResponse<'endCurrentSession'>>('/sessions/current', { allDevices })
  } finally {
    await clearSession()
  }
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
