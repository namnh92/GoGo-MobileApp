import { env } from '@/shared/config/env'

import { ApiError, NetworkError, TimeoutError } from './errors'
import {
  assertSessionGeneration,
  captureSessionScope,
  clearSession,
  getSession,
  hydrateSession,
  isAccessTokenExpired,
  persistSession,
  sessionFromGrant,
  type Session,
  type SessionScope,
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
  /**
   * `<deviceId>.<deviceSecret>` for the device routes (ADR-0038). Replaces the
   * session bearer and never enters the refresh path: a 401 here is a client bug.
   */
  deviceCredential?: string
  /** Sent as `Idempotency-Key` — required for retryable mutations (RULE-API-004). */
  idempotencyKey?: string
  /** Conditional public reference-data reads. */
  ifNoneMatch?: string
  /** Strong resource validator returned by the BFF for conditional writes. */
  ifMatch?: string
  /** Reject an unexpected success status before consuming its body. */
  expectedStatus?: number
  onResponseHeaders?: (headers: Headers) => void
  revalidate?: boolean
  timeoutMs?: number
  signal?: AbortSignal
  /** Reject account-bound work after any sign-out or actor change, including HTTP replay. */
  sessionGeneration?: number
}

/**
 * Called when the session cannot be renewed. The app uses it to purge room
 * caches and route to sign-in — the client itself never navigates.
 */
let onSessionExpired: ((scope: SessionScope) => void) | null = null

export function setOnSessionExpired(handler: ((scope: SessionScope) => void) | null): void {
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

let refreshInFlight: { generation: number; promise: Promise<Session | null> } | null = null

async function requestTokenGrant(body: { refreshToken: string } | { guestToken: string }, scope: SessionScope): Promise<TokenGrant> {
  return send({ method: 'POST', path: '/auth/refresh', body, anonymous: true }, null, scope, async response => {
    if (!response.ok) throw await scope.wait(toApiError(response))
    return scope.wait(response.json() as Promise<TokenGrant>)
  })
}

async function refreshSession(scope: SessionScope): Promise<Session | null> {
  scope.assert()
  const generation = scope.generation
  if (refreshInFlight?.generation === generation) return refreshInFlight.promise

  const promise = (async () => {
    const session = getSession()
    if (!session) return null

    const credential =
      session.kind === 'guest' && session.guestToken
        ? { guestToken: session.guestToken }
        : session.refreshToken
          ? { refreshToken: session.refreshToken }
          : null

    if (!credential) {
      await endSessionLocally(generation)
      return null
    }

    try {
      const grant = await requestTokenGrant(credential, scope)
      assertSessionGeneration(generation)
      const renewed = await persistSession(sessionFromGrant(grant, session), generation)
      assertSessionGeneration(generation)
      return renewed
    } catch (error) {
      // A late refresh must neither replace nor sign out a newer account.
      assertSessionGeneration(generation)
      // 401 means the credential is dead (rotated, revoked, expired) — sign out.
      // A network blip must NOT destroy a still-valid refresh token.
      if (error instanceof ApiError && error.status === 401) {
        await endSessionLocally(generation)
        return null
      }
      throw error
    }
  })()
  const flight = { generation, promise }
  refreshInFlight = flight

  try {
    return await promise
  } finally {
    if (refreshInFlight === flight) refreshInFlight = null
  }
}

async function endSessionLocally(generation: number): Promise<void> {
  await clearSession(false, generation)
  assertSessionGeneration(generation + 1)
  onSessionExpired?.(captureSessionScope(generation + 1))
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
    details: envelope.details,
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

async function send<T>(options: RequestOptions, accessToken: string | null, scope: SessionScope, consume: (response: Response) => Promise<T>): Promise<T> {
  scope.assert()
  if (options.signal?.aborted) throw new Error('Request aborted')
  // Built before the try below: a missing path param or an unserialisable body
  // is a programming error, and must not be disguised as a network failure.
  const url = buildUrl(options)
  const payload = options.body === undefined ? undefined : JSON.stringify(options.body)

  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const onExternalAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onExternalAbort)
  scope.signal.addEventListener('abort', onExternalAbort)

  const headers: Record<string, string> = { accept: 'application/json' }
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (options.deviceCredential) headers.authorization = `Device ${options.deviceCredential}`
  else if (accessToken) headers.authorization = `Bearer ${accessToken}`
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey
  if (options.ifNoneMatch) headers['if-none-match'] = options.ifNoneMatch
  if (options.ifMatch) headers['if-match'] = options.ifMatch
  if (options.revalidate) headers['cache-control'] = 'no-cache'

  try {
    let response: Response
    try {
      response = await scope.wait(fetch(url, {
        method: options.method,
        headers,
        body: payload,
        signal: controller.signal,
      }))
    } catch (error) {
      scope.assert()
      if (options.signal?.aborted) throw error
      if (controller.signal.aborted) throw new TimeoutError(timeoutMs)
      throw new NetworkError('NETWORK_UNREACHABLE', error)
    }
    scope.assert()
    // Keep cancellation attached through body consumption, not just headers.
    return await scope.wait(consume(response))
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', onExternalAbort)
    scope.signal.removeEventListener('abort', onExternalAbort)
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
export async function currentAccessGrant(
  options: { force?: boolean } = {},
): Promise<{ token: string; expiresAt: number } | null> {
  const active = captureSessionScope()
  if (!getSession()) await active.wait(hydrateSession())
  let session = getSession()
  if (session && (options.force || isAccessTokenExpired(session))) session = await refreshSession(active)
  if (session) active.assert()
  if (!session) return null
  return { token: session.accessToken, expiresAt: session.expiresAt }
}

export async function request<T>(options: RequestOptions): Promise<T> {
  const scope = captureSessionScope(options.sessionGeneration)
  let accessToken: string | null = null

  if (!options.anonymous && !options.deviceCredential) {
    if (!getSession()) {
      await scope.wait(hydrateSession())
    }
    const session = getSession()
    const active = session && isAccessTokenExpired(session) ? await refreshSession(scope) : session
    scope.assert()
    accessToken = active?.accessToken ?? null
  }

  const consume = async (response: Response): Promise<T> => {
    scope.assert()
    if (!response.ok || (options.expectedStatus !== undefined && response.status !== options.expectedStatus)) throw await scope.wait(toApiError(response))
    options.onResponseHeaders?.(response.headers)
    return scope.wait(parseBody<T>(response))
  }
  return send(options, accessToken, scope, async response => {
    if (response.status === 401 && !options.anonymous && accessToken) {
      const renewed = await refreshSession(scope)
      if (!renewed) throw await toApiError(response)
      scope.assert()
      return send(options, renewed.accessToken, scope, consume)
    }
    return consume(response)
  })
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

/** Public conditional GET: a 304 must never enter the JSON/error body parsers. */
export async function conditionalGet<T>(
  path: string,
  options: Pick<RequestOptions, 'query' | 'ifNoneMatch' | 'signal'> = {},
): Promise<{ status: 304; etag: string | null } | { status: 200; etag: string | null; data: T }> {
  const scope = captureSessionScope()
  return send({ ...options, method: 'GET', path, anonymous: true, revalidate: true }, null, scope, async response => {
    const etag = response.headers.get('etag')
    if (response.status === 304) return { status: 304, etag }
    if (!response.ok) throw await scope.wait(toApiError(response))
    return { status: 200, etag, data: await scope.wait(parseBody<T>(response)) }
  })
}
