import type { useRouter } from 'expo-router'

import { track } from '@/shared/analytics'

import { parseDeepLink, routeForAction, type DeepLinkAction } from './deep-link'

type Router = ReturnType<typeof useRouter>

/** Where a link came from. Kept for analytics, never for routing decisions. */
export type DeepLinkSource = 'push' | 'deferred' | 'share' | 'manual'

/**
 * The single way anything other than a tapped URL opens a resource.
 *
 * Expo Router already turns an incoming URL into a route, so this deliberately
 * does not add a second `Linking` listener — that would navigate twice for one
 * tap. What it covers is every source Expo Router never sees: a push payload, a
 * deferred link recovered after install, a link pasted or shared into the app.
 * They all normalise through the same parser, so a notification and a browser
 * tap cannot drift onto different destinations for the same room.
 */
export function openDeepLink(router: Router, url: string | null | undefined, source: DeepLinkSource): DeepLinkAction {
  const action = parseDeepLink(url)
  track('deep_link_opened', { kind: action.kind, source })
  // An unrecognised link still lands somewhere real rather than nowhere.
  router.push(routeForAction(action))
  return action
}
