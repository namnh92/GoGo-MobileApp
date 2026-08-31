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
 * `Giảm chuyển động` in iOS/Android accessibility settings. Motion that ignores
 * this is not a style choice — it can trigger nausea in people with vestibular
 * disorders, which is why every animation in the app reads this.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    let cancelled = false
    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => {
        if (!cancelled) setReduced(value)
      })
      .catch(() => {})

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => {
      cancelled = true
      subscription.remove()
    }
  }, [])

  return reduced
}

/** A duration that collapses to an instant cut when motion is reduced. */
export function motionDuration(duration: number, reduced: boolean): number {
  return reduced ? 0 : duration
}
