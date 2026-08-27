import { api } from '../client'
import { newIdempotencyKey } from '../idempotency'
import type { OpBody, OpQuery, OpResponse } from '../types'

export type SavedTargetType = 'place' | 'plan'

// --- saved -----------------------------------------------------------------

export function listSaved(): Promise<OpResponse<'listSaved'>> {
  return api.get<OpResponse<'listSaved'>>('/me/saved')
}

/** Idempotent server-side — saving twice is not an error. */
export function saveItem(type: SavedTargetType, id: string): Promise<void> {
  return api.put<void>('/me/saved/{type}/{id}', undefined, { pathParams: { type, id } })
}

export function unsaveItem(type: SavedTargetType, id: string): Promise<void> {
  return api.delete<void>('/me/saved/{type}/{id}', undefined, { pathParams: { type, id } })
}

// --- reviews ---------------------------------------------------------------

export function createReview(
  body: OpBody<'createReview'>,
  idempotencyKey = newIdempotencyKey(),
): Promise<OpResponse<'createReview'>> {
  return api.post<OpResponse<'createReview'>>('/reviews', body, { idempotencyKey })
}

/** Editing sends the review back to `pending` moderation. */
export function updateReview(id: string, body: OpBody<'updateReview'>): Promise<OpResponse<'updateReview'>> {
  return api.patch<OpResponse<'updateReview'>>('/reviews/{id}', body, { pathParams: { id } })
}

export function listMyReviews(): Promise<OpResponse<'listMyReviews'>> {
  return api.get<OpResponse<'listMyReviews'>>('/me/reviews')
}

// --- notifications ---------------------------------------------------------

export function listNotifications(
  query?: OpQuery<'listNotifications'>,
): Promise<OpResponse<'listNotifications'>> {
  return api.get<OpResponse<'listNotifications'>>('/me/notifications', { query })
}

export function markNotificationRead(id: string): Promise<void> {
  return api.post<void>('/me/notifications/{id}/read', undefined, { pathParams: { id } })
}

export function getNotificationPreferences(): Promise<OpResponse<'getNotificationPreferences'>> {
  return api.get<OpResponse<'getNotificationPreferences'>>('/me/notification-preferences')
}

export function setNotificationPreference(body: OpBody<'setNotificationPreference'>): Promise<void> {
  return api.put<void>('/me/notification-preferences', body)
}

/** Push is only a trigger — the app refetches from the API when opened. */
export function registerDeviceToken(body: OpBody<'registerDeviceToken'>): Promise<void> {
  return api.put<void>('/me/device-tokens', body)
}
