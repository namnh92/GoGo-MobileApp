import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  deleteSecureItem,
  getSecureItem,
  setOrDeleteSecureItem,
  setSecureItem,
} from '@/shared/storage/secure-store'

import type { TokenGrant } from './types'

/**
 * Two session kinds exist in the contract:
 * - `user`  — login/register grant, rotating single-use refresh token.
 * - `guest` — room-scoped access token plus a long-lived opaque `guestToken`
 *   used both for re-entry and for the claim-on-register flow (FR-AUTH-002/003).
 */
export type SessionKind = 'user' | 'guest'

export interface Session {
  kind: SessionKind
  accessToken: string
  /** Epoch ms when the access token expires (renewed slightly early). */
  expiresAt: number
  refreshToken?: string
  guestToken?: string
  userId?: string
  /** Guest sessions are scoped to exactly one room. */
  roomId?: string
  guestSessionId?: string
}

const INSTALL_KEY = 'gogo.install.v1'

const KEY_ACCESS = 'gogo.access_token'
const KEY_REFRESH = 'gogo.refresh_token'
const KEY_GUEST = 'gogo.guest_token'
const KEY_META = 'gogo.session_meta'

type SessionMeta = Omit<Session, 'accessToken' | 'refreshToken' | 'guestToken'>

let current: Session | null = null
let hydrated = false
let hydration: Promise<Session | null> | null = null
const listeners = new Set<(session: Session | null) => void>()

function emit(): void {
  for (const listener of listeners) listener(current)
}

export function subscribeToSession(listener: (session: Session | null) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSession(): Session | null {
  return current
}

export function isHydrated(): boolean {
  return hydrated
}

/** Read persisted credentials once at app start. Safe to call repeatedly. */
export async function hydrateSession(): Promise<Session | null> {
  if (hydration) return hydration
  if (hydrated) return current
  hydration = hydratePersistedSession().finally(() => { hydration = null })
  return hydration
}

async function hydratePersistedSession(): Promise<Session | null> {

  // Keychain survives iOS uninstall; the app-container marker does not.
  // Fail closed if local storage cannot confirm this installation.
  try {
    if (await AsyncStorage.getItem(INSTALL_KEY) !== '1') {
      await clearSession(true)
      await AsyncStorage.setItem(INSTALL_KEY, '1')
      return null
    }
  } catch {
    current = null
    hydrated = true
    emit()
    return null
  }

  const [accessToken, refreshToken, guestToken, rawMeta] = await Promise.all([
    getSecureItem(KEY_ACCESS),
    getSecureItem(KEY_REFRESH),
    getSecureItem(KEY_GUEST),
    getSecureItem(KEY_META),
  ])

  hydrated = true

  if (!accessToken || !rawMeta) {
    current = null
    emit()
    return null
  }

  let meta: SessionMeta
  try {
    meta = JSON.parse(rawMeta) as SessionMeta
  } catch {
    await clearSession()
    return null
  }

  current = {
    ...meta,
    accessToken,
    refreshToken: refreshToken ?? undefined,
    guestToken: guestToken ?? undefined,
  }
  emit()
  return current
}

export async function persistSession(session: Session): Promise<Session> {
  await AsyncStorage.setItem(INSTALL_KEY, '1')
  const { accessToken, refreshToken, guestToken, ...meta } = session
  await Promise.all([
    setSecureItem(KEY_ACCESS, accessToken),
    setOrDeleteSecureItem(KEY_REFRESH, refreshToken),
    setOrDeleteSecureItem(KEY_GUEST, guestToken),
    setSecureItem(KEY_META, JSON.stringify(meta)),
  ])
  current = session
  hydrated = true
  emit()
  return session
}

export async function clearSession(strict = false): Promise<void> {
  await Promise.all([
    deleteSecureItem(KEY_ACCESS, strict),
    deleteSecureItem(KEY_REFRESH, strict),
    deleteSecureItem(KEY_GUEST, strict),
    deleteSecureItem(KEY_META, strict),
  ])
  current = null
  hydrated = true
  emit()
}

/** Renew this many ms before the server-side expiry so in-flight calls do not race it. */
const EXPIRY_SKEW_MS = 30_000

export function expiresAtFrom(expiresInSeconds: number): number {
  return Date.now() + expiresInSeconds * 1000
}

export function isAccessTokenExpired(session: Session, now = Date.now()): boolean {
  return session.expiresAt - EXPIRY_SKEW_MS <= now
}

/**
 * Server default for `AUTH_ACCESS_TOKEN_TTL_SECONDS`. Guest-token renewal
 * answers `{ accessToken, roomId }` without `expiresIn`, so we fall back to it
 * rather than computing an expiry from `undefined`.
 */
const DEFAULT_ACCESS_TTL_SECONDS = 900

/** Build a user session from a login/register/refresh TokenGrant. */
export function sessionFromGrant(grant: TokenGrant, previous?: Session | null): Session {
  const isGuestRenewal = Boolean(grant.roomId) && !grant.refreshToken
  return {
    kind: isGuestRenewal ? 'guest' : 'user',
    accessToken: grant.accessToken,
    expiresAt: expiresAtFrom(grant.expiresIn ?? DEFAULT_ACCESS_TTL_SECONDS),
    // A rotating grant always supersedes the old refresh token; a guest renewal
    // keeps the long-lived guestToken it was renewed with.
    refreshToken: grant.refreshToken ?? (isGuestRenewal ? undefined : previous?.refreshToken),
    guestToken: isGuestRenewal ? previous?.guestToken : undefined,
    userId: grant.userId ?? (isGuestRenewal ? undefined : previous?.userId),
    roomId: grant.roomId ?? (isGuestRenewal ? previous?.roomId : undefined),
    guestSessionId: isGuestRenewal ? previous?.guestSessionId : undefined,
  }
}

export interface GuestGrant {
  guestSessionId?: string
  roomId?: string
  accessToken?: string
  guestToken?: string
}

/** Guest join responses are not TokenGrants — they carry a room-scoped pair. */
export function sessionFromGuestGrant(
  grant: GuestGrant,
  accessTtlSeconds = DEFAULT_ACCESS_TTL_SECONDS,
): Session {
  if (!grant.accessToken) throw new Error('Guest grant missing accessToken')
  return {
    kind: 'guest',
    accessToken: grant.accessToken,
    expiresAt: expiresAtFrom(accessTtlSeconds),
    guestToken: grant.guestToken,
    roomId: grant.roomId,
    guestSessionId: grant.guestSessionId,
  }
}
