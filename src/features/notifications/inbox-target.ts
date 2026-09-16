import { getCurrentPlan, getPlan, getRoom, isApiError, type Notification } from '@/shared/api'
import { isUuid } from '@/shared/navigation/deep-link'
import { PLAN_KINDS, PLAN_RETRY_NOTICE, PLAN_UNAVAILABLE_NOTICE } from '@/shared/navigation/room-routing'

/**
 * GoGo-MobileApp#198 — where an inbox row opens.
 *
 * Deliberately the same rule as the tapped-push resolver in #264
 * (`resolveRoomOrPlan`, branch `bugfix/GOGO-256-push-tap-routing`), written a
 * second time only because that branch is not on develop yet. When it lands,
 * this file is replaced by it on rebase: one notification must not open two
 * different screens depending on where it was tapped.
 *
 * Nothing here navigates; it decides.
 */
export type InboxDecision =
  | { to: 'open'; path: string }
  /** The API refused: removed, or no longer this account's. */
  | { to: 'refused' }
  /** Nothing could be read (network, server): another tap may work. */
  | { to: 'retry' }
  /** A kind with nowhere to go. */
  | { to: 'none' }

/** How long a tap waits before opening what the payload itself named (as #264). */
export const INBOX_RESOLVE_BUDGET_MS = 4_000

/** Answers that mean "this account cannot open this", not "try again". */
const REFUSED: ReadonlySet<number> = new Set([401, 403, 404, 410])

type Read<T> = { state: 'fresh'; data: T } | { state: 'refused' } | { state: 'unknown' }

async function read<T>(load: () => Promise<T>): Promise<Read<T>> {
  try {
    return { state: 'fresh', data: await load() }
  } catch (error) {
    return isApiError(error) && REFUSED.has(error.status) ? { state: 'refused' } : { state: 'unknown' }
  }
}

/** A payload is data from outside this build; an id that is not a UUID is dropped (#203). */
function payloadIds(notification: Notification): { roomId: string | null; planId: string | null } {
  const payload = (notification.payload ?? {}) as Record<string, unknown>
  return {
    roomId: isUuid(payload.roomId) ? payload.roomId : null,
    planId: isUuid(payload.planId) ? payload.planId : null,
  }
}

async function decide(notification: Notification): Promise<InboxDecision> {
  const kind = notification.kind ?? ''
  const { roomId, planId: namedPlanId } = payloadIds(notification)

  if (!PLAN_KINDS.has(kind)) {
    const aboutRoom = kind === 'invite' || kind === 'preference_reminder'
    return aboutRoom && roomId ? { to: 'open', path: `/room/${roomId}` } : { to: 'none' }
  }
  if (!roomId && !namedPlanId) return { to: 'none' }

  let planId = namedPlanId
  if (namedPlanId) {
    const plan = await read(() => getPlan(namedPlanId))
    // An edit or a regenerate supersedes the plan a notification named: the
    // room's current plan is the one to open. A plan that cannot be read right
    // now still opens; its screen has an offline state of its own.
    if (plan.state === 'refused' || (plan.state === 'fresh' && plan.data.status === 'superseded' && roomId)) {
      planId = null
    }
  }

  // A plan kind that names only its room — every one DEV sends — opens the
  // room's current plan, not the lobby.
  let planUnknown = false
  if (!planId && roomId) {
    const current = await read(() => getCurrentPlan(roomId))
    const currentId = current.state === 'fresh' ? current.data?.id : undefined
    if (isUuid(currentId)) planId = currentId
    else planUnknown = current.state === 'unknown'
  }

  // The room decides access when there is no plan to open, and whether a date
  // reminder opens the running date.
  if (roomId && (!planId || kind === 'date_reminder')) {
    const room = await read(() => getRoom(roomId))
    if (room.state === 'refused') return { to: 'refused' }
    if (planId && room.state === 'fresh' && room.data.status === 'active') {
      return { to: 'open', path: `/plans/${planId}/active` }
    }
    if (!planId && planUnknown && room.state === 'unknown') return { to: 'retry' }
  }

  if (planId) return { to: 'open', path: `/plans/${planId}` }
  if (roomId) {
    return { to: 'open', path: `/room/${roomId}?notice=${planUnknown ? PLAN_RETRY_NOTICE : PLAN_UNAVAILABLE_NOTICE}` }
  }
  return { to: 'refused' }
}

/** Past the budget, what the payload named opens; that screen has its own offline state. */
function withinBudgetFallback(notification: Notification): InboxDecision {
  const { roomId, planId } = payloadIds(notification)
  if (planId) return { to: 'open', path: `/plans/${planId}` }
  if (roomId) return { to: 'open', path: `/room/${roomId}?notice=${PLAN_RETRY_NOTICE}` }
  return { to: 'retry' }
}

export async function resolveInboxTarget(
  notification: Notification,
  budgetMs: number = INBOX_RESOLVE_BUDGET_MS,
): Promise<InboxDecision> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const budget = new Promise<InboxDecision>(resolve => {
    timer = setTimeout(() => resolve(withinBudgetFallback(notification)), budgetMs)
  })
  try {
    return await Promise.race([decide(notification), budget])
  } finally {
    clearTimeout(timer)
  }
}
