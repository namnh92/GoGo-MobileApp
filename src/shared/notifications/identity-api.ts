import { api } from '@/shared/api/client'
import { ApiError } from '@/shared/api/errors'
import type { OpResponse } from '@/shared/api/types'

import type { IdentityFetchOutcome } from './identity-session'

/**
 * NTF-APP-004 (#51) — `GET /v1/notifications/identity`.
 *
 * Three answers, and the difference between them decides what the device does:
 *
 *   - 200: a short-lived ES256 token naming this user;
 *   - 503 `PUSH_IDENTITY_UNAVAILABLE`: this environment holds no signing key.
 *     Not an error to retry — it does not come back on its own, and the server
 *     says so with `retryable: false`;
 *   - anything else: transient. Worth another go on the next session change.
 *
 * The token is returned to the caller and nowhere else. It is never stored,
 * never logged, and never put in an analytics event.
 */
export async function fetchIdentityToken(): Promise<IdentityFetchOutcome> {
  try {
    // Typed from the generated schema, so a contract change fails the build
    // rather than the device.
    const token = await api.get<OpResponse<'getPushIdentityToken'>>('/notifications/identity')
    return { kind: 'ok', token }
  } catch (error) {
    if (error instanceof ApiError && error.code === 'PUSH_IDENTITY_UNAVAILABLE') {
      return { kind: 'unavailable' }
    }
    return { kind: 'error' }
  }
}
