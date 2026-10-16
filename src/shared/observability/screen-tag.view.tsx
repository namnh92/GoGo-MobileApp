import { useSegments } from 'expo-router'
import { useEffect } from 'react'

import { setSentryScreen } from './sentry'

/**
 * The route template of the screen on top, as expo-router names it:
 * `/room/[roomId]/preference`, `/(tabs)/plans`, `/` for the launch screen (the
 * one route with no segments). The pathname, which carries the room or invite
 * code, is never read. Whether the value is one the app declares is decided by
 * `setSentryScreen`, the reporting boundary (ADR-0011 D-12) — not here.
 */
export function screenTemplate(segments: readonly string[]): string {
  return `/${segments.join('/')}`
}

type Props = {
  /**
   * Test seam (Sol F-02, PR #349): the effect phase the writer runs in.
   * Production renders `<SentryScreenTag />` and writes from `useEffect`; the
   * spec measures `useLayoutEffect` against it, on this component, not a copy.
   */
  useWriteEffect?: typeof useEffect
}

/**
 * GoGo-MobileApp#341 — tags every Sentry event, JS and native, with the screen
 * it happened on. Renders nothing; mounted once in the root layout, before the
 * navigator. Until its first effect the tag is the launch screen `/`, seeded
 * by `initSentry` before anything renders.
 *
 * The root layout learns the new segments in a later commit than the one that
 * mounts the new screen, so an error thrown synchronously while that screen
 * renders or mounts (its effects, `componentDidMount`) carries the previous
 * screen; from the next task on, the tag is the new one. The effect phase
 * changes nothing (measured on both, Sol F-02 on PR #349). ADR 0010.
 */
export function SentryScreenTag({ useWriteEffect = useEffect }: Props) {
  const template = screenTemplate(useSegments())
  useWriteEffect(() => {
    setSentryScreen(template)
  }, [template])
  return null
}
