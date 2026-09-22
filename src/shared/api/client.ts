import { env } from '@/shared/config/env'

import { ApiError, NetworkError, TimeoutError } from './errors'
import {
  clearSession,
  getSession,
  hydrateSession,
  isAccessTokenExpired,
  persistSession,
  sessionFromGrant,
  type Session,
} from './session'
import type { ErrorEnvelope, TokenGrant } from './types'

const DEFAULT_TIMEOUT_MS = 15_000

export type QueryValue = string | number | boolean | null | undefined | (string | number | boolean)[]

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** OpenAPI path template, e.g. `/rooms/{id}/members`. */
  path: string
  pathParams?: Record<string, string>
  query?: Record<string, QueryValue>
  body?: unknown
  /** Skip the Authorization header (login, register, guest join, refresh). */
  anonymous?: boolean
  /** Sent as `Idempotency-Key` — required for retryable mutations (RULE-API-004). */
  idempotencyKey?: string
  timeoutMs?: number
  signal?: AbortSignal
}

/**
 * Called when the session cannot be renewed. The app uses it to purge room
 * caches and route to sign-in — the client itself never navigates.
 */
let onSessionExpired: (() => void) | null = null

export function setOnSessionExpired(handler: (() => void) | null): void {
  onSessionExpired = handler
}

function buildUrl(options: RequestOptions): string {
  const base = env.apiUrl.replace(/\/+$/, '')
  const path = options.path.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = options.pathParams?.[key]
    if (value === undefined || value === '') {
      throw new Error(`Missing path param "${key}" for ${options.path}`)
    }
    return encodeURIComponent(value)
  })

  const pairs: string[] = []
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === undefined || value === null || value === '') continue
    // OpenAPI form/explode: arrays repeat the key.
    const values = Array.isArray(value) ? value : [value]
    for (const item of values) {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`)
    }
  }

  return pairs.length > 0 ? `${base}${path}?${pairs.join('&')}` : `${base}${path}`
}

// ---------------------------------------------------------------------------
// Token refresh — single-flight so a burst of 401s triggers exactly one rotate.
// Refresh tokens are single-use: a parallel second call would revoke the family.
// ---------------------------------------------------------------------------

let refreshInFlight: Promise<Session | null> | null = null

async function requestTokenGrant(body: { refreshToken: string } | { guestToken: string }): Promise<TokenGrant> {
  const response = await fetch(`${env.apiUrl.replace(/\/+$/, '')}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw await toApiError(response)
  }
  return (await response.json()) as TokenGrant
}

async function refreshSession(): Promise<Session | null> {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const session = getSession()
    if (!session) return null

    const credential =
      session.kind === 'guest' && session.guestToken
        ? { guestToken: session.guestToken }
        : session.refreshToken
          ? { refreshToken: session.refreshToken }
          : null

    if (!credential) {
      await endSessionLocally()
      return null
    }

    try {
      const grant = await requestTokenGrant(credential)
      return await persistSession(sessionFromGrant(grant, session))
    } catch (error) {
      // 401 means the credential is dead (rotated, revoked, expired) — sign out.
      // A network blip must NOT destroy a still-valid refresh token.
      if (error instanceof ApiError && error.status === 401) {
        await endSessionLocally()
        return null
      }
      throw error
    }
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

async function endSessionLocally(): Promise<void> {
  await clearSession()
  onSessionExpired?.()
}

// ---------------------------------------------------------------------------
// Response handling
// ---------------------------------------------------------------------------

async function toApiError(response: Response): Promise<ApiError> {
  let envelope: Partial<ErrorEnvelope> = {}
  try {
    const parsed: unknown = await response.json()
    if (parsed && typeof parsed === 'object') envelope = parsed as Partial<ErrorEnvelope>
  } catch {
    // Non-JSON body (proxy/gateway error page) — fall back to the status.
  }
  return new ApiError(response.status, {
    code: envelope.code ?? `HTTP_${response.status}`,
    message: envelope.message ?? `Request failed with status ${response.status}`,
    field_errors: envelope.field_errors,
    request_id: envelope.request_id,
    retryable: envelope.retryable,
  }, response.headers.get('retry-after'))
}

async function parseBody<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.status === 205) return undefined as T
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) return (await response.text()) as unknown as T
  const text = await response.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

// ---------------------------------------------------------------------------
// Core request
// ---------------------------------------------------------------------------

async function send(options: RequestOptions, accessToken: string | null): Promise<Response> {
  // Built before the try below: a missing path param or an unserialisable body
  // is a programming error, and must not be disguised as a network failure.
  const url = buildUrl(options)
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body)

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const onExternalAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onExternalAbort)

  const headers: Record<string, string> = { accept: 'application/json' }
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (accessToken) headers.authorization = `Bearer ${accessToken}`
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey

  try {
    return await fetch(url, {
      method: options.method,
      headers,
      body: payload,
      signal: controller.signal,
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    if (controller.signal.aborted) throw new TimeoutError(timeoutMs)
    throw new NetworkError('NETWORK_UNREACHABLE', error)
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onExternalAbort)
  }
}

/**
 * A valid bearer for a long-lived stream, with the moment it stops being one.
 *
 * The SSE transport cannot go through `request`: that function reads a whole
 * response, and a stream never ends. It still must not mint its own session —
 * refresh tokens are single-use, so a second rotator would revoke the family.
 * This shares the same single-flight refresh as every other call.
 */
export async function currentAccessGrant(): Promise<{ token: string; expiresAt: number } | null> {
  let session = getSession() ?? (await hydrateSession())
  if (session && isAccessTokenExpired(session)) session = await refreshSession()
  if (!session) return null
  return { token: session.accessToken, expiresAt: session.expiresAt }
}

export async function request<T>(options: RequestOptions): Promise<T> {
  let accessToken: string | null = null

  if (!options.anonymous) {
    let session = getSession() ?? (await hydrateSession())
    if (session && isAccessTokenExpired(session)) {
      session = await refreshSession()
    }
    accessToken = session?.accessToken ?? null
  }

  let response = await send(options, accessToken)

  if (response.status === 401 && !options.anonymous && accessToken) {
    const renewed = await refreshSession()
    if (!renewed) throw await toApiError(response)
    response = await send(options, renewed.accessToken)
  }

  if (!response.ok) throw await toApiError(response)
  return parseBody<T>(response)
}

export const api = {
  get: <T>(path: string, options: Omit<RequestOptions, 'method' | 'path' | 'body'> = {}) =>
    request<T>({ ...options, method: 'GET', path }),
  post: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'path' | 'body'> = {}) =>
    request<T>({ ...options, method: 'POST', path, body }),
  put: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'path' | 'body'> = {}) =>
    request<T>({ ...options, method: 'PUT', path, body }),
  patch: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'path' | 'body'> = {}) =>
    request<T>({ ...options, method: 'PATCH', path, body }),
  delete: <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'path' | 'body'> = {}) =>
    request<T>({ ...options, method: 'DELETE', path, body }),
}
