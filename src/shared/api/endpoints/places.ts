import { api } from '../client'
import type { OpBody, OpQuery, OpResponse, ReviewOrder } from '../types'

export type PlaceSearchQuery = OpQuery<'searchPlaces'>

/** Public — search works before sign-in (RULE-SEC: no auth needed for discovery). */
export function searchPlaces(query: PlaceSearchQuery): Promise<OpResponse<'searchPlaces'>> {
  return api.get<OpResponse<'searchPlaces'>>('/places/search', { query, anonymous: true })
}

/** Note: `PlaceDetail` is snake_case in the contract, unlike every other DTO. */
export function getPlaceDetail(placeId: string): Promise<OpResponse<'getPlaceDetail'>> {
  return api.get<OpResponse<'getPlaceDetail'>>('/places/{id}', {
    pathParams: { id: placeId },
    anonymous: true,
  })
}

/**
 * BE-BFF-018 — at most three published GoGo reviews, newest first. Public like
 * Place Detail; carries no provider rating. BE-BFF-019 adds `order=helpful`,
 * which falls back to newest when nothing has a mark.
 */
export function listPlaceReviews(
  placeId: string,
  order: ReviewOrder = 'latest',
): Promise<OpResponse<'listPlaceReviews'>> {
  return api.get<OpResponse<'listPlaceReviews'>>('/places/{id}/reviews', {
    pathParams: { id: placeId },
    query: { order },
    anonymous: true,
  })
}

/**
 * Area autocomplete via the BFF proxy — the provider key stays server-side.
 * `sessionToken` groups keystrokes of one autocomplete session into a single
 * billable provider request, so it must stay stable until a pick is made.
 */
export function suggestAreas(query: OpQuery<'suggestAreas'>): Promise<OpResponse<'suggestAreas'>> {
  return api.get<OpResponse<'suggestAreas'>>('/places/areas', { query, anonymous: true })
}

/** Preview only — resolving a link never creates a place. */
export function resolveGoogleMapsLink(
  body: OpBody<'resolveGoogleMapsLink'>,
): Promise<OpResponse<'resolveGoogleMapsLink'>> {
  return api.post<OpResponse<'resolveGoogleMapsLink'>>('/places/resolve-google-maps-link', body, {
    anonymous: true,
  })
}

export function submitPlaceImport(
  body: OpBody<'submitPlaceImport'>,
): Promise<OpResponse<'submitPlaceImport'>> {
  return api.post<OpResponse<'submitPlaceImport'>>('/places/imports', body)
}

/**
 * The spec declares this 200 without a schema, so the generated type is
 * `unknown`. Shape per the operation description — the only hand-written
 * response type in the client, and it goes away once the spec declares one.
 */
export interface PlaceImportStatus {
  id: string
  status: 'pending' | 'verified' | 'rejected'
  reasonCode?: string
  placeId?: string
}

export function getPlaceImport(importId: string): Promise<PlaceImportStatus> {
  return api.get<PlaceImportStatus>('/places/imports/{importId}', { pathParams: { importId } })
}

export function submitPlace(body: OpBody<'submitPlace'>): Promise<OpResponse<'submitPlace'>> {
  return api.post<OpResponse<'submitPlace'>>('/place-submissions', body)
}

export function getPlaceSubmission(id: string): Promise<OpResponse<'getPlaceSubmission'>> {
  return api.get<OpResponse<'getPlaceSubmission'>>('/place-submissions/{id}', { pathParams: { id } })
}
