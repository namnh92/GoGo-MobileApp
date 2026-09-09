import { api } from '../client'
import type { OpBody, OpResponse } from '../types'

/**
 * ADR-0022 — the avatar half of the profile. `uploadKey` is what
 * `POST /uploads { purpose: 'avatar' }` handed out after the bytes were PUT;
 * the server attaches, decodes, crops and publishes, and answers the whole
 * profile with the new `avatarUrl`. The client never composes that URL.
 */
export function setAvatar(body: OpBody<'setAvatar'>): Promise<OpResponse<'setAvatar'>> {
  return api.put<OpResponse<'setAvatar'>>('/me/avatar', body)
}

/** Idempotent: an account with no avatar answers the same profile it had. */
export function removeAvatar(): Promise<OpResponse<'removeAvatar'>> {
  return api.delete<OpResponse<'removeAvatar'>>('/me/avatar')
}

/**
 * The curated areas a profile may name as its home — the whole list, grouped
 * by city on the client, cached an hour at the edge. Public: no session, no
 * provider call, no billing session token (ADR-0022).
 */
export function listServiceAreas(): Promise<OpResponse<'listServiceAreas'>> {
  return api.get<OpResponse<'listServiceAreas'>>('/service-areas', { anonymous: true })
}
