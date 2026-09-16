import { z } from 'zod'

import { isUuid, parseDeepLink, type DeepLinkAction } from '@/shared/navigation/deep-link'

/**
 * GoGo-MobileApp#256 — what a tapped push should open.
 *
 * The payload is data from outside this build. There are two senders:
 *
 *   - **transactional** (GoGo-BE#594, contract v1): `route`, the canonical link,
 *     plus `type`/`kind` and ids. `kind` + `roomId` alone is what DEV sent
 *     before `route` existed, and still routes;
 *   - **campaigns** (`campaign-dispatcher`): `{ campaignId, destinationType,
 *     destination? }` — no kind and no route.
 *
 * Nothing here navigates: it decides, so the mapping can be asserted without a
 * navigator.
 */

/**
 * The destinations a transactional notification may open (spec §19). An invite
 * code or a share slug is never one: a push must not carry a credential, so a
 * route naming one is treated as unusable.
 */
export type NotificationDestination = Extract<
  DeepLinkAction,
  { kind: 'room' | 'plan' | 'place' | 'saved' | 'notifications' | 'profile' }
>

/** Where a campaign can send someone in this app; `null` is Home. */
export type CampaignDestination = Extract<DeepLinkAction, { kind: 'place' | 'saved' }> | null

export type NotificationTarget =
  | {
      status: 'open'
      action: NotificationDestination
      via: 'route' | 'kind'
      key: string | null
      /** `type` (or legacy `kind`), when the payload named one. */
      kind: string | null
      /** The room the notification is about, when the payload named one. */
      roomId: string | null
    }
  | { status: 'campaign'; destination: CampaignDestination; key: string | null }
  | { status: 'invalid'; key: string | null }

/** The notifications screen reads this to say why it opened instead. */
export const PUSH_UNAVAILABLE_NOTICE = 'push_unavailable'

/** Kinds about the room itself; the plan kinds open the room's plan. */
export const ROOM_KINDS: ReadonlySet<string> = new Set(['invite', 'preference_reminder'])
export const PLAN_KINDS: ReadonlySet<string> = new Set(['plan_ready', 'plan_changed', 'date_reminder'])

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
  campaignId: field(64),
  destinationType: field(32),
  destination: field(2000),
})

type PushData = z.infer<typeof pushData>

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
 * `CampaignDestination` in the contract: `home`, `place`, `recommendation`,
 * `plan_template`, `saved`, `external_url`. This app has a screen for a place and
 * for the saved tab. Everything else opens Home — the behaviour campaign pushes
 * had before any of this existed — rather than an error, and an external URL is
 * never opened from a notification tap.
 */
function campaignDestination(data: PushData): CampaignDestination {
  switch (data.destinationType) {
    case 'place':
      return isUuid(data.destination) ? { kind: 'place', placeId: data.destination } : null
    case 'saved':
      return { kind: 'saved' }
    default:
      return null
  }
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
  const kind = data.type ?? data.kind ?? null

  // Not a transactional notification: a campaign, or anything that names
  // neither a kind nor a route. It was never about a room the reader may have
  // lost, so it must not say so.
  if (data.campaignId || (!kind && !data.route)) {
    return { status: 'campaign', destination: campaignDestination(data), key }
  }

  const roomId = [data.entityType === 'room' ? data.entityId : undefined, data.roomId].find(isUuid) ?? null
  const planId = [data.entityType === 'plan' ? data.entityId : undefined, data.planId].find(isUuid) ?? null

  if (data.route) {
    const action = parseDeepLink(data.route)
    if (isDestination(action)) return { status: 'open', action, via: 'route', key, kind, roomId }
  }

  if (kind && PLAN_KINDS.has(kind) && planId) {
    return { status: 'open', action: { kind: 'plan', planId }, via: 'kind', key, kind, roomId }
  }
  if (kind && (PLAN_KINDS.has(kind) || ROOM_KINDS.has(kind)) && roomId) {
    return { status: 'open', action: { kind: 'room', roomId }, via: 'kind', key, kind, roomId }
  }
  return { status: 'invalid', key }
}
