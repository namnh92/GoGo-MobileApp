import * as Crypto from 'expo-crypto'

/**
 * `Idempotency-Key` for retryable mutations (RULE-API-004). The key must stay
 * stable across retries of the *same* user intent, so callers generate it once
 * when the intent is formed — not per network attempt.
 */
export function newIdempotencyKey(): string {
  return Crypto.randomUUID()
}
