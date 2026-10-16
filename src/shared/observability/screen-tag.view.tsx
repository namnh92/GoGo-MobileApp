import { useSegments } from 'expo-router'
import { useEffect } from 'react'

import { setSentryScreen } from './sentry'

/**
 * The route template of the screen on top: `/room/[roomId]/preference`, `/(tabs)/plans`,
 * `/` for the launch screen (the one route with no segments). Segments are the
 * file names under `src/app/`, so the value never carries a parameter — the
 * room or invite code lives in the pathname, which is never read here.
 */
export function screenTemplate(segments: readonly string[]): string {
  return `/${segments.join('/')}`
}

/**
 * GoGo-MobileApp#341 — tags every Sentry event, JS and native, with the screen
 * it happened on. Renders nothing; mounted once in the root layout.
 *
 * Set from an effect, so it follows a committed navigation: an error thrown in
 * the first render of a screen (caught by the root boundary) still carries the
 * previous screen. Accepted (owner, 2026-10-16); ADR 0010.
 */
export function SentryScreenTag() {
  const template = screenTemplate(useSegments())
  useEffect(() => {
    setSentryScreen(template)
  }, [template])
  return null
}
