import { getSessionGeneration } from '@/shared/api/session'
import { newIdempotencyKey, type ResolveLinkResult } from '@/shared/api'

export interface SavedLinkHandoff {
  url: string
  resolution?: ResolveLinkResult
  error?: unknown
}

// A single short-lived navigation handoff, never persisted or serialized into a
// route: the resolution proof must stay in memory and belong to this session.
let pending: { id: string; epoch: number; expires: number; value: SavedLinkHandoff } | undefined
export function prepareSavedLinkHandoff(value: SavedLinkHandoff) {
  const id = newIdempotencyKey()
  pending = { id, epoch: getSessionGeneration(), expires: Date.now() + 60_000, value }
  return id
}
export function readSavedLinkHandoff(id?: string) {
  if (pending && (pending.epoch !== getSessionGeneration() || pending.expires < Date.now())) pending = undefined
  return pending?.id === id ? pending?.value : undefined
}
export function clearSavedLinkHandoff(id?: string) {
  if (pending?.id === id) pending = undefined
}
