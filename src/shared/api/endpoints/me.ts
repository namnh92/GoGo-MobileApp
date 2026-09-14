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

/**
 * NTF-APP-010 (#215) — the account's one push switch (GoGo-BE#572, ADR-0025).
 * An app preference only: not this device's OS permission, not a registered
 * subscription, never evidence of delivery.
 */
export function getNotificationSettings(): Promise<OpResponse<'getNotificationSettings'>> {
  return api.get<OpResponse<'getNotificationSettings'>>('/me/notification-settings')
}

export function setNotificationSettings(
  body: OpBody<'setNotificationSettings'>,
): Promise<OpResponse<'setNotificationSettings'>> {
  return api.put<OpResponse<'setNotificationSettings'>>('/me/notification-settings', body)
}

/**
 * NTF-APP-008 (#171) — tell the API this device holds a live push subscription.
 *
 * Not a device token: `subscriptionId` is OneSignal's own id, the same one
 * `POST /notifications/identity/logout` already takes, and the server verifies
 * it against the provider before recording anything. It is what a campaign
 * audience is built from — GoGo-BE#515.
 */
export function registerPushSubscription(
  body: OpBody<'registerPushSubscription'>,
): Promise<OpResponse<'registerPushSubscription'>> {
  return api.put<OpResponse<'registerPushSubscription'>>('/me/push-subscriptions', body)
}
