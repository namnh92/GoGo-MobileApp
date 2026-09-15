import { isApiError, isOffline, TimeoutError } from '@/shared/api'
import type { AnalyticsProps } from '@/shared/analytics'
import type { MessageKey } from '@/shared/i18n/types'

/**
 * #252 — why a sign-in or sign-up did not complete, as a stable reason code.
 *
 * Every failure that was not an HTTP error envelope used to read "Mất kết nối",
 * including exceptions thrown on the device before any request left it. A
 * phone that was online could not be told apart from a dead network, and
 * nothing was recorded to tell them apart afterwards.
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
  messageKey: MessageKey
  /** The server's own field message, shown as it always was. */
  serverMessage?: string
  /**
   * What analytics may carry: the reason, the HTTP status and the envelope's
   * machine code, and for a device-side exception its class name. Never the
   * error message — it can echo what the person typed.
   */
  telemetry: AnalyticsProps
}

const ERROR_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/

function errorName(error: unknown): string {
  const name = error instanceof Error ? error.name : typeof error
  return ERROR_NAME.test(name) ? name : 'unknown'
}

export function classifyAuthFailure(error: unknown): AuthFailure {
  // A timeout is also "offline" to the shared helper, so it is asked first.
  if (error instanceof TimeoutError) {
    return { reason: 'timeout', messageKey: 'auth.timeoutError', telemetry: { reason: 'timeout' } }
  }
  if (isOffline(error)) {
    return { reason: 'offline', messageKey: 'auth.networkError', telemetry: { reason: 'offline' } }
  }
  if (isApiError(error)) {
    const telemetry = { status: error.status, code: error.code }
    // Login is enumeration-safe: the server never says which half was wrong,
    // and neither do we.
    if (error.status === 401) {
      return { reason: 'invalid_credentials', messageKey: 'auth.invalidCredentials', telemetry: { reason: 'invalid_credentials', ...telemetry } }
    }
    if (error.status === 409) {
      return { reason: 'conflict', messageKey: 'auth.registerConflict', telemetry: { reason: 'conflict', ...telemetry } }
    }
    if (error.status === 429) {
      return { reason: 'rate_limited', messageKey: 'auth.rateLimited', telemetry: { reason: 'rate_limited', ...telemetry } }
    }
    if (error.fieldErrors.length > 0) {
      return {
        reason: 'field_invalid',
        messageKey: 'auth.genericError',
        serverMessage: error.fieldErrors[0].message,
        telemetry: { reason: 'field_invalid', ...telemetry },
      }
    }
    const reason = error.status >= 500 ? 'server' : 'rejected'
    return { reason, messageKey: 'auth.genericError', telemetry: { reason, ...telemetry } }
  }
  return {
    reason: 'unexpected',
    messageKey: 'auth.unexpectedError',
    telemetry: { reason: 'unexpected', errorName: errorName(error) },
  }
}
