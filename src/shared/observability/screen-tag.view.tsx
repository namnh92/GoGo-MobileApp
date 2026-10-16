import { useSegments } from 'expo-router'
import { useEffect } from 'react'

import { SCREEN_TEMPLATES } from './screen-templates'
import { setSentryScreen, UNKNOWN_SCREEN } from './sentry'

/**
 * The route template of the screen on top: `/room/[roomId]/preference`, `/(tabs)/plans`,
 * `/` for the launch screen (the one route with no segments). Only a template
 * the app declares ({@link SCREEN_TEMPLATES}) is returned as itself; anything
 * else — Expo Router appends a `?screen=` query value to the segments — is
 * `unknown`. The pathname, which carries the room or invite code, is never read.
 */
export function screenTemplate(segments: readonly string[]): string {
  const template = `/${segments.join('/')}`
  return SCREEN_TEMPLATES.has(template) ? template : UNKNOWN_SCREEN
}

/**
 * GoGo-MobileApp#341 — tags every Sentry event, JS and native, with the screen
 * it happened on. Renders nothing; mounted once in the root layout, before the
 * navigator.
 *
 * The root layout learns the new segments in a later commit than the one that
 * mounts the new screen, so an error thrown synchronously while that screen
 * renders or mounts (its effects, `componentDidMount`) carries the previous
 * screen; from the next task on, the tag is the new one. A layout effect here
 * changes nothing (measured, Sol F-02 on PR #349). ADR 0010.
 */
export function SentryScreenTag() {
  const template = screenTemplate(useSegments())
  useEffect(() => {
    setSentryScreen(template)
  }, [template])
  return null
}
