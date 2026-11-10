import { api } from '../client'
import type { OpBody, OpResponse } from '../types'

export function requestPasswordRecovery(body: OpBody<'requestPasswordRecovery'>, idempotencyKey: string) {
  return api.post<OpResponse<'requestPasswordRecovery'>>('/auth/password-recovery/request', body, { anonymous: true, idempotencyKey })
}

/** A successful reset revokes sessions server-side and never installs a new one. */
export function completePasswordRecovery(body: OpBody<'completePasswordRecovery'>, idempotencyKey: string) {
  return api.post<OpResponse<'completePasswordRecovery'>>('/auth/password-recovery/complete', body, { anonymous: true, idempotencyKey })
}
