import type { ErrorEnvelope, FieldError } from './types'

/**
 * Every non-2xx response becomes an ApiError carrying the BFF error envelope
 * (`{ code, message, field_errors, request_id, retryable }`). Screens branch on
 * `code` / `status`, never on the human message.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: FieldError[]
  readonly requestId?: string
  readonly retryable: boolean
  readonly retryAt: number

  constructor(status: number, envelope: Partial<ErrorEnvelope> & { code: string; message: string }, retryAfter?: string | null) {
    super(envelope.message)
    this.name = 'ApiError'
    const seconds = retryAfter?.trim() ? Number(retryAfter) : NaN
    const deadline = Number.isFinite(seconds) ? Date.now() + Math.max(0, seconds) * 1000 : Date.parse(retryAfter ?? "")
    this.retryAt = Number.isFinite(deadline) ? deadline : 0
    this.status = status
    this.code = envelope.code
    this.fieldErrors = envelope.field_errors ?? []
    this.requestId = envelope.request_id
    this.retryable = envelope.retryable ?? false
  }

  /** Field-level messages keyed by field name, for react-hook-form `setError`. */
  fieldErrorMap(): Record<string, string> {
    return Object.fromEntries(this.fieldErrors.map(e => [e.field, e.message]))
  }
}

/** Network unreachable / DNS / TLS — distinct from an HTTP error envelope. */
export class NetworkError extends Error {
  readonly cause?: unknown
  constructor(message = 'NETWORK_UNREACHABLE', cause?: unknown) {
    super(message)
    this.name = 'NetworkError'
    this.cause = cause
  }
}

/** Client-side abort after the request budget elapsed. */
export class TimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super('REQUEST_TIMEOUT')
    this.name = 'TimeoutError'
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function isOffline(error: unknown): boolean {
  return error instanceof NetworkError || error instanceof TimeoutError
}

export function isUnauthorized(error: unknown): boolean {
  return isApiError(error) && error.status === 401
}

export function isForbidden(error: unknown): boolean {
  return isApiError(error) && error.status === 403
}

export function isConflict(error: unknown): boolean {
  return isApiError(error) && error.status === 409
}

/** 4xx other than 408/425/429 will never succeed on retry. */
export function isRetryable(error: unknown): boolean {
  if (isOffline(error)) return true
  if (!isApiError(error)) return false
  if (error.retryable) return true
  if (error.status >= 500) return true
  return error.status === 408 || error.status === 425 || error.status === 429
}

/**
 * #198 — the ranking the client holds no longer matches the room: preferences
 * or constraints changed after it was built. Finalize answers
 * `STALE_SUGGESTIONS`; a pick or vote on a candidate from that ranking answers
 * `NOT_A_CANDIDATE`. Both are answered by a fresh run, never by a retry.
 */
export function isStaleRanking(error: unknown): boolean {
  return isApiError(error) && (error.code === 'STALE_SUGGESTIONS' || error.code === 'NOT_A_CANDIDATE')
}

/**
 * #251 — stop completion and check-in only work while the room is `active`
 * (check-in also after `completed`). This is a room-state answer, never a
 * connectivity one, and retrying it changes nothing until the room moves.
 */
/**
 * #198 — the room is not matching any more: a plan was chosen, or the host
 * reopened preferences. A vote is refused with this, and no retry saves it.
 */
export function isRoomNotMatching(error: unknown): boolean {
  return isApiError(error) && error.status === 409 && error.code === 'ROOM_NOT_MATCHING'
}

export function isRoomNotActive(error: unknown): boolean {
  return isApiError(error) && error.status === 409 && error.code === 'ROOM_NOT_ACTIVE'
}
