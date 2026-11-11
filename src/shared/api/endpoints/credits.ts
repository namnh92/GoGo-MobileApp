import { api } from '../client'
import type { OpResponse } from '../types'

export function getMyCredits(signal?: AbortSignal): Promise<OpResponse<'getMyCredits'>> {
  return api.get('/me/credits', { signal })
}

export function getMyCreditLedger(cursor?: string, signal?: AbortSignal): Promise<OpResponse<'getMyCreditLedger'>> {
  return api.get('/me/credits/ledger', { query: { limit: 10, cursor }, signal })
}
