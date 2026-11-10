import { api } from '../client'
import type { operations, OpBody, OpResponse } from '../types'

export type RecoveryAccountNotFoundResponse = operations['requestPasswordRecovery']['responses'][404]['content']['application/json']

export function requestPasswordRecovery(body: OpBody<'requestPasswordRecovery'>, idempotencyKey: string) {
  return api.post<OpResponse<'requestPasswordRecovery'>>('/auth/password-recovery/request', body, { anonymous: true, idempotencyKey, expectedStatus: 202 })
}

/** A successful reset revokes sessions server-side and never installs a new one. */
export function completePasswordRecovery(body: OpBody<'completePasswordRecovery'>, idempotencyKey: string) {
  return api.post<OpResponse<'completePasswordRecovery'>>('/auth/password-recovery/complete', body, { anonymous: true, idempotencyKey })
}
