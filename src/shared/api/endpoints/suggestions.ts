import { api } from '../client'
import { newIdempotencyKey } from '../idempotency'
import type { OpBody, OpResponse, VoteValue } from '../types'

/** Runs the deterministic pipeline; also the way to clear a `stale` run. */
export function generateSuggestions(roomId: string): Promise<OpResponse<'generateSuggestions'>> {
  return api.post<OpResponse<'generateSuggestions'>>('/rooms/{roomId}/suggestions', undefined, {
    pathParams: { roomId },
  })
}

export function getCurrentSuggestions(roomId: string): Promise<OpResponse<'getCurrentSuggestions'>> {
  return api.get<OpResponse<'getCurrentSuggestions'>>('/rooms/{roomId}/suggestions/current', {
    pathParams: { roomId },
  })
}

/**
 * Votes are idempotent (RULE-API-004): re-sending the same value is a no-op.
 * In couple `match` mode a mutual yes returns `matched: true` plus the created
 * `planId`.
 */
export function castVote(
  roomId: string,
  placeId: string,
  value: VoteValue,
  idempotencyKey = newIdempotencyKey(),
): Promise<OpResponse<'castVote'>> {
  return api.put<OpResponse<'castVote'>>(
    '/rooms/{roomId}/votes/{placeId}',
    { value },
    { pathParams: { roomId, placeId }, idempotencyKey },
  )
}

/** Host-only tally (star = 2, yes = 1) that creates plan v1. */
export function finalizeVotes(
  roomId: string,
  body: OpBody<'finalizeVotes'>,
  idempotencyKey = newIdempotencyKey(),
): Promise<OpResponse<'finalizeVotes'>> {
  return api.post<OpResponse<'finalizeVotes'>>('/rooms/{roomId}/votes/finalize', body, {
    pathParams: { roomId },
    idempotencyKey,
  })
}
