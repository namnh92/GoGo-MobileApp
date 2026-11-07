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
let generation = 0
let hydrated = false
let hydration: Promise<Session | null> | null = null
// A late native write cannot be cancelled. Drain every key before allowing an
// account transition to write, including when another key failed early.
let credentialOperation: Promise<void> = Promise.resolve()
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

/** Account lifetime, unchanged by token rotation; sign-out also invalidates A → A work. */
export function getSessionGeneration(): number {
  return generation
}

export function assertSessionGeneration(expected: number): void {
  if (generation !== expected) throw new Error('Session changed before mutation completed')
}

function sameAccount(session: Session): boolean {
  return current?.kind === session.kind && current?.userId === session.userId
    && current?.roomId === session.roomId && current?.guestSessionId === session.guestSessionId
}

function setCurrent(session: Session | null): void {
  current = session
  hydrated = true
  emit()
}

function beginAccountTransition(): number {
  const epoch = ++generation
  // Invalidate queued work before the first storage await. Until the new
  // credentials are durable no caller may obtain the old account's tokens.
  setCurrent(null)
  return epoch
}

function serializeCredentials<T>(operation: () => Promise<T>): Promise<T> {
  const result = credentialOperation.then(operation)
  credentialOperation = result.then(() => {}, () => {})
  return result
}

async function settleCredentialWrites(writes: Promise<void>[]): Promise<void> {
  const results = await Promise.allSettled(writes)
  for (const result of results) {
    if (result.status === 'rejected') throw result.reason
  }
}

function deleteCredentials(strict: boolean): Promise<void> {
  return settleCredentialWrites([
    deleteSecureItem(KEY_ACCESS, strict),
    deleteSecureItem(KEY_REFRESH, strict),
    deleteSecureItem(KEY_GUEST, strict),
    deleteSecureItem(KEY_META, strict),
  ])
}

export function isHydrated(): boolean {
  return hydrated
}

/** Read persisted credentials once at app start. Safe to call repeatedly. */
export async function hydrateSession(): Promise<Session | null> {
  if (hydrated) return current
  if (hydration) return hydration
  const expected = generation
  hydration = serializeCredentials(async () => {
    // Hydration may have been queued before sign-in/sign-out. It must not
    // restore an obsolete snapshot or erase the transition's credentials.
    if (generation !== expected) return current
    return hydratePersistedSession(expected)
  }).finally(() => { hydration = null })
  return hydration
}

async function hydratePersistedSession(expected: number): Promise<Session | null> {

  // Keychain survives iOS uninstall; the app-container marker does not.
  // Fail closed if local storage cannot confirm this installation.
  try {
    const installed = await AsyncStorage.getItem(INSTALL_KEY)
    if (generation !== expected) return current
    if (installed !== '1') {
      await deleteCredentials(true)
      if (generation !== expected) return current
      await AsyncStorage.setItem(INSTALL_KEY, '1')
      if (generation !== expected) return current
      setCurrent(null)
      return null
    }
  } catch {
    if (generation !== expected) return current
    setCurrent(null)
    return null
  }

  const [accessToken, refreshToken, guestToken, rawMeta] = await Promise.all([
    getSecureItem(KEY_ACCESS),
    getSecureItem(KEY_REFRESH),
    getSecureItem(KEY_GUEST),
    getSecureItem(KEY_META),
  ])

  if (generation !== expected) return current

  if (!accessToken || !rawMeta) {
    setCurrent(null)
    return null
  }

  let meta: SessionMeta
  try {
    meta = JSON.parse(rawMeta) as SessionMeta
  } catch {
    await deleteCredentials(false)
    if (generation !== expected) return current
    setCurrent(null)
    return null
  }

  generation += 1
  setCurrent({
    ...meta,
    accessToken,
    refreshToken: refreshToken ?? undefined,
    guestToken: guestToken ?? undefined,
  })
  return current
}

/** Renewal passes its captured generation; account replacement reserves a new one synchronously. */
export async function persistSession(session: Session, expected = generation): Promise<Session> {
  assertSessionGeneration(expected)
  const epoch = sameAccount(session) ? generation : beginAccountTransition()
  await serializeCredentials(async () => {
    assertSessionGeneration(epoch)
    const { accessToken, refreshToken, guestToken, ...meta } = session
    await settleCredentialWrites([
      setSecureItem(KEY_ACCESS, accessToken),
      setOrDeleteSecureItem(KEY_REFRESH, refreshToken),
      setOrDeleteSecureItem(KEY_GUEST, guestToken),
      setSecureItem(KEY_META, JSON.stringify(meta)),
    ])
    assertSessionGeneration(epoch)
    // Marker failure does not turn a valid server login into a client error;
    // hydration still fails closed on the next launch.
    await AsyncStorage.setItem(INSTALL_KEY, '1').catch(() => {})
    assertSessionGeneration(epoch)
    setCurrent(session)
  })
  assertSessionGeneration(epoch)
  return session
}

export async function clearSession(strict = false, expected = generation): Promise<void> {
  assertSessionGeneration(expected)
  const epoch = beginAccountTransition()
  await serializeCredentials(async () => {
    assertSessionGeneration(epoch)
    await deleteCredentials(strict)
    assertSessionGeneration(epoch)
  })
  assertSessionGeneration(epoch)
}

/**
 * Renew this many ms before the server-side expiry so in-flight calls do not
 * race it. Exported because anything that schedules work around the expiry has
 * to land inside this window to get a new token rather than the same one back
 * (GoGo-MobileApp#286).
 */
export const EXPIRY_SKEW_MS = 30_000

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
