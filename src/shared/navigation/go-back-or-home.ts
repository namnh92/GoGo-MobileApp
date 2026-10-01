import type { useRouter } from 'expo-router'

/** Only the three methods this needs, so a test can stand in for the router. */
type BackCapableRouter = Pick<ReturnType<typeof useRouter>, 'canGoBack' | 'back' | 'replace'>

/**
 * The way out of a screen that may be the only one on the stack.
 *
 * A cold start from a link builds a stack containing just the destination —
 * the root Stack declares no `initialRouteName`, so nothing sits underneath.
 * `router.back()` then does nothing at all: on iOS the back control is inert
 * and there is no edge swipe, and on Android the hardware button closes the
 * app. GoGo-MobileApp#218 (I14) saw it on the invite screen; every deep-link
 * destination has the same hole (#268).
 *
 * The fallback is `/`, the splash, not `/(tabs)`: splash is what decides
 * between onboarding and Home, so landing on the tabs would walk a fresh
 * install past onboarding.
 *
 * Hardware back is deliberately left alone — this is the in-screen control.
 */
export function goBackOrHome(router: BackCapableRouter): void {
  if (router.canGoBack()) router.back()
  else router.replace('/')
}
