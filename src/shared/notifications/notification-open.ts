import type { QueryClient } from '@tanstack/react-query'
import type { useRouter } from 'expo-router'

import { track } from '@/shared/analytics'
import { getPlan } from '@/shared/api/endpoints/plans'
import { getRoom } from '@/shared/api/endpoints/rooms'
import { isApiError } from '@/shared/api/errors'
import { queryKeys } from '@/shared/api/query-keys'
import type { DeepLinkAction } from '@/shared/navigation/deep-link'
import { openDeepLinkAction } from '@/shared/navigation/open-deep-link'

import { PUSH_UNAVAILABLE_NOTICE, type NotificationTarget } from './notification-target'

type Router = ReturnType<typeof useRouter>

/** Spec §20: a notification that cannot be opened lands on the inbox, and says so. */
export const PUSH_UNAVAILABLE_ROUTE = `/notifications?notice=${PUSH_UNAVAILABLE_NOTICE}`

/** How long a tap waits on the refetch before opening the screen anyway. */
export const REFETCH_BUDGET_MS = 4_000

/** Answers that mean "this account cannot open this", not "try again". */
const REFUSED = new Set([401, 403, 404, 410])

export type OpenNotificationDeps = {
  router: Router
  queryClient: QueryClient
  /** Hydrated session status: `user`, `guest` or `anonymous`. */
  status: string
  budgetMs?: number
}

type Verdict = 'fresh' | 'refused' | 'unknown'

/**
 * Push is only a trigger: what the screen shows comes from the API, now, not
 * from the payload or from a cache written before the event.
 *
 * Everything under the resource is marked stale — members, suggestions, the
 * current plan — so each screen refetches what it reads, and the resource
 * itself is read before navigating so a refusal can be answered without
 * opening a screen that cannot load.
 */
async function refetch(
  action: Extract<DeepLinkAction, { kind: 'room' | 'plan' }>,
  deps: OpenNotificationDeps,
): Promise<Verdict> {
  const { queryClient } = deps
  const key = action.kind === 'room' ? queryKeys.room(action.roomId) : queryKeys.plan(action.planId)
  await queryClient.invalidateQueries({ queryKey: key, refetchType: 'none' })
  const request: Promise<unknown> =
    action.kind === 'room'
      ? queryClient.fetchQuery({
          queryKey: queryKeys.room(action.roomId),
          queryFn: () => getRoom(action.roomId),
          staleTime: 0,
          retry: false,
        })
      : queryClient.fetchQuery({
          queryKey: queryKeys.plan(action.planId),
          queryFn: () => getPlan(action.planId),
          staleTime: 0,
          retry: false,
        })

  let timer: ReturnType<typeof setTimeout> | undefined
  const budget = new Promise<Verdict>(resolve => {
    timer = setTimeout(() => resolve('unknown'), deps.budgetMs ?? REFETCH_BUDGET_MS)
  })
  try {
    return await Promise.race([request.then((): Verdict => 'fresh'), budget])
  } catch (error) {
    return isApiError(error) && REFUSED.has(error.status) ? 'refused' : 'unknown'
  } finally {
    clearTimeout(timer)
  }
}

function showUnavailable(router: Router, reason: 'invalid' | 'signed_out' | 'refused'): void {
  track('deep_link_opened', { kind: 'unknown', source: 'push', reason })
  router.push(PUSH_UNAVAILABLE_ROUTE)
}

/**
 * GoGo-MobileApp#256 — open a tapped notification through the one
 * DeepLinkRouter (#57), so a push and a link cannot drift onto different
 * screens for the same room.
 *
 * A refusal (signed out, no longer a member, deleted) goes to the inbox with a
 * message. Anything else that stops the refetch — offline, a server error, a
 * slow network — still opens the screen, which has its own offline and error
 * states and may hold a cached copy worth reading.
 */
export async function openNotificationTarget(
  target: NotificationTarget,
  deps: OpenNotificationDeps,
): Promise<void> {
  if (target.status === 'invalid') return showUnavailable(deps.router, 'invalid')
  const { action } = target
  if (action.kind === 'room' || action.kind === 'plan') {
    // A push left in the tray after sign-out has nothing this device may open.
    if (deps.status !== 'user' && deps.status !== 'guest') return showUnavailable(deps.router, 'signed_out')
    if ((await refetch(action, deps)) === 'refused') return showUnavailable(deps.router, 'refused')
  }
  openDeepLinkAction(deps.router, action, 'push')
}
