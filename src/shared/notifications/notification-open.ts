import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { useRouter } from 'expo-router'

import { track } from '@/shared/analytics'
import { getCurrentPlan, getPlan } from '@/shared/api/endpoints/plans'
import { getRoom } from '@/shared/api/endpoints/rooms'
import { isApiError } from '@/shared/api/errors'
import { queryKeys } from '@/shared/api/query-keys'
import { isUuid, type DeepLinkAction } from '@/shared/navigation/deep-link'
import { openDeepLinkAction } from '@/shared/navigation/open-deep-link'

import { PLAN_KINDS, PUSH_UNAVAILABLE_NOTICE, type NotificationTarget } from './notification-target'

type Router = ReturnType<typeof useRouter>

/** Spec §20: a notification that cannot be opened lands on the inbox, and says so. */
export const PUSH_UNAVAILABLE_ROUTE = `/notifications?notice=${PUSH_UNAVAILABLE_NOTICE}`

/** How long a tap waits on the refetch before opening what the payload named. */
export const REFETCH_BUDGET_MS = 4_000

/** Answers that mean "this account cannot open this", not "try again". */
const REFUSED = new Set([401, 403, 404, 410])

export type OpenNotificationDeps = {
  router: Router
  queryClient: QueryClient
  /** Hydrated session status: `user`, `guest` or `anonymous`. */
  status: string
  /** The screen on show now. A change while the refetch runs means the person moved on. */
  currentPath?: () => string
  /** The tap launched the app: nothing the person chose is on the stack yet. */
  coldStart?: boolean
  budgetMs?: number
  report?: (event: string) => void
}

type Decision =
  | { to: 'resource'; action: DeepLinkAction; path?: string }
  | { to: 'unavailable'; reason: 'invalid' | 'refused' }
  | { to: 'inbox' }
  | { to: 'home' }

type Read<T> = { state: 'fresh'; data: T } | { state: 'refused' } | { state: 'unknown' }

/**
 * Push is only a trigger: what a screen shows comes from the API, now. The
 * resource's query tree is marked stale — members, suggestions, the current
 * plan — so every screen refetches what it reads, and the resource itself is
 * read here so a refusal is answered before a screen that cannot load opens.
 */
async function read<T>(queryClient: QueryClient, queryKey: QueryKey, queryFn: () => Promise<T>): Promise<Read<T>> {
  try {
    await queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
    const data = await queryClient.fetchQuery({ queryKey, queryFn, staleTime: 0, retry: false })
    return { state: 'fresh', data }
  } catch (error) {
    return isApiError(error) && REFUSED.has(error.status) ? { state: 'refused' } : { state: 'unknown' }
  }
}

async function resolveRoomOrPlan(
  target: Extract<NotificationTarget, { status: 'open' }>,
  queryClient: QueryClient,
): Promise<Decision> {
  const { action, kind } = target
  const roomId = action.kind === 'room' ? action.roomId : target.roomId
  const wantsPlan = action.kind === 'plan' || (kind !== null && PLAN_KINDS.has(kind))
  let planId: string | null = action.kind === 'plan' ? action.planId : null

  if (planId) {
    const named = planId
    const plan = await read(queryClient, queryKeys.plan(named), () => getPlan(named))
    // An edit or a regenerate supersedes the plan a push named: the room's
    // current plan is the one to open.
    if (plan.state === 'refused' || (plan.state === 'fresh' && plan.data.status === 'superseded' && roomId)) {
      planId = null
    }
  }

  // A plan kind that names only its room — every push DEV sent before contract
  // v1 — opens the room's current plan, not the lobby.
  if (!planId && wantsPlan && roomId) {
    const current = await read(queryClient, queryKeys.roomCurrentPlan(roomId), () => getCurrentPlan(roomId))
    if (current.state === 'fresh' && isUuid(current.data.id)) planId = current.data.id
  }

  // The room decides access when there is no plan to read, and whether a date
  // reminder opens the running date or the plan (coordinator decision,
  // 2026-09-15; the active screen has its own room-status gate, #251).
  if (roomId && (!planId || kind === 'date_reminder')) {
    const room = await read(queryClient, queryKeys.room(roomId), () => getRoom(roomId))
    if (room.state === 'refused') return { to: 'unavailable', reason: 'refused' }
    if (planId && room.state === 'fresh' && room.data.status === 'active') {
      return { to: 'resource', action: { kind: 'plan', planId }, path: `/plans/${planId}/active` }
    }
  }

  if (planId) return { to: 'resource', action: { kind: 'plan', planId } }
  if (roomId) return { to: 'resource', action: { kind: 'room', roomId } }
  return { to: 'unavailable', reason: 'refused' }
}

async function decide(target: NotificationTarget, deps: OpenNotificationDeps): Promise<Decision> {
  if (target.status === 'invalid') return { to: 'unavailable', reason: 'invalid' }
  if (target.status === 'campaign') {
    return target.destination ? { to: 'resource', action: target.destination } : { to: 'home' }
  }
  const { action } = target
  if (action.kind !== 'room' && action.kind !== 'plan') return { to: 'resource', action }
  // A push left in the tray after sign-out: nothing this device may read.
  if (deps.status !== 'user' && deps.status !== 'guest') return { to: 'inbox' }

  let timer: ReturnType<typeof setTimeout> | undefined
  // Past the budget the payload's own destination opens; its screen has an
  // offline and an error state of its own.
  const budget = new Promise<Decision>(resolve => {
    timer = setTimeout(() => resolve({ to: 'resource', action }), deps.budgetMs ?? REFETCH_BUDGET_MS)
  })
  try {
    return await Promise.race([resolveRoomOrPlan(target, deps.queryClient), budget])
  } finally {
    clearTimeout(timer)
  }
}

function navigate(decision: Decision, deps: OpenNotificationDeps): void {
  const { router } = deps
  // A cold start has nothing the person chose beneath the screen it opens, and
  // those screens go back with `router.back()`. Home goes underneath first, so
  // Back leads home instead of out of the app. The launch redirect normally
  // leaves exactly that (the tabs, at `/`); anywhere else is replaced by it. A
  // warm tap keeps the stack the person built.
  if (decision.to !== 'home' && deps.coldStart && deps.currentPath && deps.currentPath() !== '/') {
    router.replace('/(tabs)')
  }
  switch (decision.to) {
    case 'resource':
      if (decision.path) {
        track('deep_link_opened', { kind: decision.action.kind, source: 'push' })
        router.push(decision.path)
      } else {
        openDeepLinkAction(router, decision.action, 'push')
      }
      return
    case 'unavailable':
      track('deep_link_opened', { kind: 'unknown', source: 'push', reason: decision.reason })
      router.push(PUSH_UNAVAILABLE_ROUTE)
      return
    case 'inbox':
      // The inbox already asks a signed-out person to sign in. "Removed, or no
      // longer yours" would contradict it.
      track('deep_link_opened', { kind: 'notifications', source: 'push', reason: 'signed_out' })
      router.push('/notifications')
      return
    case 'home':
      track('deep_link_opened', { kind: 'home', source: 'push' })
      router.navigate('/(tabs)')
      return
  }
}

/** Bumped by every open; an open that is no longer the latest does not navigate. */
let latestOpen = 0

/**
 * GoGo-MobileApp#256 — open a tapped notification through the one
 * DeepLinkRouter (#57), so a push and a link cannot drift onto different
 * screens for the same room.
 *
 * Two taps close together: the latest wins, whichever refetch finishes first.
 * A person who moves to another screen while the refetch runs stays there.
 */
export async function openNotificationTarget(target: NotificationTarget, deps: OpenNotificationDeps): Promise<void> {
  const mine = ++latestOpen
  const startedOn = deps.currentPath?.()
  const decision = await decide(target, deps)
  if (mine !== latestOpen) {
    deps.report?.('push_open_superseded')
    return
  }
  if (startedOn !== undefined && deps.currentPath?.() !== startedOn) {
    deps.report?.('push_open_skipped_navigated')
    return
  }
  navigate(decision, deps)
}
