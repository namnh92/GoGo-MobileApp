import { api } from '../client'
import type { OpBody, OpQuery, OpResponse } from '../types'

export function getMyPreferences(roomId: string): Promise<OpResponse<'getMyPreferences'>> {
  return api.get<OpResponse<'getMyPreferences'>>('/rooms/{roomId}/preferences/me', {
    pathParams: { roomId },
  })
}

/**
 * Autosave with optimistic concurrency. `expectedVersion` is the version last
 * read (0 when nothing is saved yet); a 409 means another device saved first —
 * refetch and merge rather than overwrite.
 */
export function saveMyPreferences(
  roomId: string,
  body: OpBody<'saveMyPreferences'>,
): Promise<OpResponse<'saveMyPreferences'>> {
  return api.put<OpResponse<'saveMyPreferences'>>('/rooms/{roomId}/preferences/me', body, {
    pathParams: { roomId },
  })
}

/** Marks my selection done; the room flips to `matching` once everyone is in. */
export function completeMyPreferences(roomId: string): Promise<OpResponse<'completeMyPreferences'>> {
  return api.post<OpResponse<'completeMyPreferences'>>(
    '/rooms/{roomId}/preferences/complete',
    undefined,
    { pathParams: { roomId } },
  )
}

/**
 * Stable taxonomy keys plus their i18n labels. Business data stores the key —
 * labels are display only (RULE-CORE-002).
 */
export function listTaxonomies(query?: OpQuery<'listTaxonomies'>): Promise<OpResponse<'listTaxonomies'>> {
  return api.get<OpResponse<'listTaxonomies'>>('/taxonomies', { query, anonymous: true })
}
