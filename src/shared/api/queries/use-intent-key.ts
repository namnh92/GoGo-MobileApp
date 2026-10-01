import { useState } from 'react'

import { newIdempotencyKey } from '../idempotency'

/**
 * One `Idempotency-Key` per user intent (RULE-API-004), for mutations whose
 * endpoint would otherwise default a fresh key on every call (#315 F-01).
 *
 * TanStack Query calls `mutationFn` again, with the same variables, for each
 * automatic retry — so the key is remembered per variables value while the
 * mutation runs, and released when it settles. A retry after a 503 or timeout
 * therefore replays the first attempt's key, and the next tap gets a new one.
 *
 * Wire `keyFor` into `mutationFn` and `release` into `onSettled`.
 */
export function useIntentKey(): IntentKeys {
  // Created once per hook instance; the map lives as long as the component.
  const [intent] = useState(createIntentKeys)
  return intent
}

export interface IntentKeys {
  keyFor(variables: unknown): string
  release(variables: unknown): void
}

function createIntentKeys(): IntentKeys {
  const keys = new Map<unknown, string>()
  return {
    keyFor(variables) {
      const existing = keys.get(variables)
      if (existing) return existing
      const key = newIdempotencyKey()
      keys.set(variables, key)
      return key
    },
    release(variables) {
      keys.delete(variables)
    },
  }
}
