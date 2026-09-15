import { isApiError, isOffline, TimeoutError } from '@/shared/api'
import type { AnalyticsProps } from '@/shared/analytics'

/**
 * #252 — why a sign-in or sign-up did not complete, as a stable reason code.
 *
 * Every failure that was not an HTTP error envelope used to read "Mất kết nối",
 * including exceptions thrown on the device before any request left it. A
 * phone that was online could not be told apart from a dead network, and
 * nothing was recorded to tell them apart afterwards.
 *
 * The copy for each reason lives in the view as a literal lookup, so the i18n
 * key scan can read every key it may ask for.
 */
export type AuthFailureReason =
  | 'offline'
  | 'timeout'
  | 'invalid_credentials'
  | 'conflict'
  | 'rate_limited'
  | 'field_invalid'
  | 'rejected'
  | 'server'
  | 'unexpected'

export interface AuthFailure {
  reason: AuthFailureReason
  /** The server's own field message, only when it says something. */
  serverMessage?: string
  /**
   * What analytics may carry: the reason, the HTTP status, a validated envelope
   * code, and for a device-side exception its class name and a validated
   * native code. Never the error message — it can echo what the person typed —
   * and never a free-form string: `track` writes to device logs.
   */
  telemetry: AnalyticsProps
}

const ERROR_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/
/** BFF envelope codes are SCREAMING_SNAKE; a proxy or gateway page is not. */
const API_CODE = /^[A-Z][A-Z0-9_]{0,63}$/
/** Expo native modules reject with a CodedError such as `ERR_KEY_CHAIN`. */
const NATIVE_CODE = /^ERR_[A-Z0-9_]{1,60}$/

function errorName(error: unknown): string {
  const name = error instanceof Error ? error.name : typeof error
  return ERROR_NAME.test(name) ? name : 'unknown'
}

function nativeCode(error: unknown): string | null {
  const code = error instanceof Error ? (error as Error & { code?: unknown }).code : undefined
  return typeof code === 'string' && NATIVE_CODE.test(code) ? code : null
}

export function classifyAuthFailure(error: unknown): AuthFailure {
  // A timeout is also "offline" to the shared helper, so it is asked first.
  if (error instanceof TimeoutError) return { reason: 'timeout', telemetry: { reason: 'timeout' } }
  if (isOffline(error)) return { reason: 'offline', telemetry: { reason: 'offline' } }

  if (isApiError(error)) {
    const facts = { status: error.status, code: API_CODE.test(error.code) ? error.code : 'unknown' }
    const failure = (reason: AuthFailureReason): AuthFailure => ({ reason, telemetry: { reason, ...facts } })
    // Login is enumeration-safe: the server never says which half was wrong,
    // and neither do we.
    if (error.status === 401) return failure('invalid_credentials')
    if (error.status === 409) return failure('conflict')
    if (error.status === 429) return failure('rate_limited')
    if (error.fieldErrors.length > 0) {
      const message = error.fieldErrors[0].message?.trim()
      return message ? { ...failure('field_invalid'), serverMessage: message } : failure('field_invalid')
    }
    return failure(error.status >= 500 ? 'server' : 'rejected')
  }

  const code = nativeCode(error)
  return {
    reason: 'unexpected',
    telemetry: { reason: 'unexpected', errorName: errorName(error), ...(code ? { nativeCode: code } : {}) },
  }
}
