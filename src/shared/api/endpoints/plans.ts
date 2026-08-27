import { api } from '../client'
import { newIdempotencyKey } from '../idempotency'
import type { OpBody, OpResponse } from '../types'

export function getCurrentPlan(roomId: string): Promise<OpResponse<'getCurrentPlan'>> {
  return api.get<OpResponse<'getCurrentPlan'>>('/rooms/{roomId}/plans/current', {
    pathParams: { roomId },
  })
}

export function getPlan(planId: string): Promise<OpResponse<'getPlan'>> {
  return api.get<OpResponse<'getPlan'>>('/plans/{id}', { pathParams: { id: planId } })
}

/**
 * Host-only stop replacement. `expectedVersion` guards against a concurrent
 * edit; the server recomputes times, travel and costs and returns a new version.
 */
export function editPlanStops(planId: string, body: OpBody<'editPlanStops'>): Promise<OpResponse<'editPlanStops'>> {
  return api.patch<OpResponse<'editPlanStops'>>('/plans/{id}', body, { pathParams: { id: planId } })
}

/** Host-only. Locked stops are carried over verbatim (RULE-CORE-007). */
export function regeneratePlan(
  planId: string,
  body: OpBody<'regeneratePlan'> = {},
  idempotencyKey = newIdempotencyKey(),
): Promise<OpResponse<'regeneratePlan'>> {
  return api.post<OpResponse<'regeneratePlan'>>('/plans/{id}/regenerate', body, {
    pathParams: { id: planId },
    idempotencyKey,
  })
}

export function lockPlanStop(
  planId: string,
  stopId: string,
  locked: boolean,
): Promise<OpResponse<'lockPlanStop'>> {
  return api.patch<OpResponse<'lockPlanStop'>>(
    '/plans/{id}/stops/{stopId}/lock',
    { locked },
    { pathParams: { id: planId, stopId } },
  )
}

export function completePlanStop(
  planId: string,
  stopId: string,
  idempotencyKey = newIdempotencyKey(),
): Promise<OpResponse<'completePlanStop'>> {
  return api.post<OpResponse<'completePlanStop'>>(
    '/plans/{id}/stops/{stopId}/complete',
    undefined,
    { pathParams: { id: planId, stopId }, idempotencyKey },
  )
}

/** Photos and bill go to moderation; `billTotal` requires `billPhotoKey`. */
export function checkinPlanStop(
  planId: string,
  stopId: string,
  body: OpBody<'checkinPlanStop'>,
  idempotencyKey = newIdempotencyKey(),
): Promise<OpResponse<'checkinPlanStop'>> {
  return api.post<OpResponse<'checkinPlanStop'>>('/plans/{id}/stops/{stopId}/checkin', body, {
    pathParams: { id: planId, stopId },
    idempotencyKey,
  })
}
