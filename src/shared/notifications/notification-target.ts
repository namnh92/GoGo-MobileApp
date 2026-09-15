import { z } from 'zod'

import { isUuid, parseDeepLink, type DeepLinkAction } from '@/shared/navigation/deep-link'

/**
 * GoGo-MobileApp#256 — what a tapped push should open.
 *
 * The payload is data from outside this build. Contract v1 (GoGo-BE#594) sends
 * `route`, the canonical link; `type`/`kind` plus ids are the fallback, which
 * also covers every push sent before `route` existed (`kind`, `roomId`,
 * `eventType` only). Nothing here navigates: it decides, so the mapping can be
 * asserted without a navigator.
 */

/**
 * The destinations a notification may open (spec §19). An invite code or a
 * share slug is never one: a push must not carry a credential, so a payload
 * that names one is treated as if the route were absent.
 */
export type NotificationDestination = Extract<
  DeepLinkAction,
  { kind: 'room' | 'plan' | 'place' | 'saved' | 'notifications' | 'profile' }
>

export type NotificationTarget =
  | { status: 'open'; action: NotificationDestination; via: 'route' | 'kind'; key: string | null }
  | { status: 'invalid'; key: string | null }

/** The notifications screen reads this to say why it opened instead. */
export const PUSH_UNAVAILABLE_NOTICE = 'push_unavailable'

/** Each field on its own: one malformed value must not discard the others. */
const field = (max: number) => z.string().max(max).optional().catch(undefined)

const pushData = z.object({
  route: field(512),
  type: field(64),
  kind: field(64),
  roomId: field(64),
  planId: field(64),
  entityType: field(16),
  entityId: field(64),
  notificationId: field(128),
})

type PushData = z.infer<typeof pushData>

/** Kinds about the room itself; the rest open the plan when they name one. */
const ROOM_KINDS: ReadonlySet<string> = new Set(['invite', 'preference_reminder'])
const PLAN_KINDS: ReadonlySet<string> = new Set(['plan_ready', 'plan_changed', 'date_reminder'])

const DESTINATIONS: ReadonlySet<DeepLinkAction['kind']> = new Set([
  'room',
  'plan',
  'place',
  'saved',
  'notifications',
  'profile',
])

function isDestination(action: DeepLinkAction): action is NotificationDestination {
  return DESTINATIONS.has(action.kind)
}

/**
 * `key` identifies the notification for dropping repeated click events: the
 * contract's `notificationId` when present, else the provider's own id.
 */
export function notificationTarget(
  additionalData: unknown,
  providerNotificationId: string | null = null,
): NotificationTarget {
  const parsed = pushData.safeParse(additionalData)
  const data: PushData = parsed.success ? parsed.data : {}
  const key = data.notificationId ?? providerNotificationId ?? null

  if (data.route) {
    const action = parseDeepLink(data.route)
    if (isDestination(action)) return { status: 'open', action, via: 'route', key }
  }

  const kind = data.type ?? data.kind
  const roomId = [data.entityType === 'room' ? data.entityId : undefined, data.roomId].find(isUuid)
  const planId = [data.entityType === 'plan' ? data.entityId : undefined, data.planId].find(isUuid)

  if (kind && PLAN_KINDS.has(kind) && planId) {
    return { status: 'open', action: { kind: 'plan', planId }, via: 'kind', key }
  }
  if (kind && (PLAN_KINDS.has(kind) || ROOM_KINDS.has(kind)) && roomId) {
    return { status: 'open', action: { kind: 'room', roomId }, via: 'kind', key }
  }
  return { status: 'invalid', key }
}
