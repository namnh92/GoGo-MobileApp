import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { AccessibilityInfo, Platform } from 'react-native'

/**
 * Touch feedback and motion, in one place.
 *
 * Haptics are a *confirmation*, not decoration: they fire when the app commits
 * something the user cannot see happen instantly — a vote sent, a stop locked,
 * a card flown off the deck. Firing on every press would make the phone buzz
 * through a whole swipe deck.
 */

export type HapticKind = 'select' | 'impact' | 'success' | 'warning' | 'error'

/**
 * Web has no haptic API and Android's is coarse; both must degrade to nothing
 * rather than throw. A rejected promise here would surface as an unhandled
 * rejection in a gesture callback.
 */
export function haptic(kind: HapticKind = 'select'): void {
  if (Platform.OS === 'web') return

  const run =
    kind === 'select'
      ? () => Haptics.selectionAsync()
      : kind === 'impact'
        ? () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        : () =>
            Haptics.notificationAsync(
              kind === 'success'
                ? Haptics.NotificationFeedbackType.Success
                : kind === 'warning'
                  ? Haptics.NotificationFeedbackType.Warning
                  : Haptics.NotificationFeedbackType.Error,
            )

  void run().catch(() => {})
}

/**
 * Whether the OS's latest answer, heard while something was subscribed, was
 * "reduced". Only that answer is carried into a later mount — never a "not
 * reduced". The setting can change while nothing is subscribed, and the two
 * stale answers are not symmetric: a stale "reduced" costs one instant cut until
 * the OS answers again, a stale "not reduced" lets a cached image fade for
 * someone who just turned motion off (Sol #348 F-05). So a new subscription
 * starts from `true` or from "unknown", and the caller treats unknown as reduced.
 */
let lastAnswerReduced = false

/**
 * `Giảm chuyển động` in iOS/Android accessibility settings, or `null` while the
 * OS has not answered yet for this subscription. A caller that animates
 * something which can happen before the answer — a cached image fading in on
 * its first frame — treats `null` as reduced (GoGo-MobileApp#338).
 */
export function useReducedMotionPreference(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(lastAnswerReduced ? true : null)

  useEffect(() => {
    let cancelled = false
    const update = (value: boolean) => {
      lastAnswerReduced = value
      if (!cancelled) setReduced(value)
    }
    AccessibilityInfo.isReduceMotionEnabled()
      .then(update)
      .catch(() => {})

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update)
    return () => {
      cancelled = true
      subscription.remove()
    }
  }, [])

  return reduced
}

/**
 * `Giảm chuyển động` in iOS/Android accessibility settings. Motion that ignores
 * this is not a style choice — it can trigger nausea in people with vestibular
 * disorders, which is why every animation in the app reads this.
 */
export function useReducedMotion(): boolean {
  return useReducedMotionPreference() ?? false
}

/** A duration that collapses to an instant cut when motion is reduced. */
export function motionDuration(duration: number, reduced: boolean): number {
  return reduced ? 0 : duration
}
