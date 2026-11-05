import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { Icon } from '@/shared/ui/icons'
import { useReducedMotion } from '@/shared/ui/feedback'

import { styles } from './matching.style'

const PING_MS = 3000
const PULSE_MS = 2200
const SPIN_MS = 9000

/** Runs a 0 to 1 loop while `running`, and rests at 0 otherwise. */
function useLoop(running: boolean, duration: number, reverse: boolean): SharedValue<number> {
  const progress = useSharedValue(0)
  useEffect(() => {
    if (!running) {
      cancelAnimation(progress)
      progress.set(0)
      return
    }
    progress.set(withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, reverse))
    return () => cancelAnimation(progress)
  }, [running, duration, reverse, progress])
  return progress
}

/**
 * The mark of the run, as the "Đang ghép" draft moves it: a ring spreading out, a
 * ring breathing, the compass turning slowly. Decoration only, hidden from screen
 * readers. Still when nothing is running, and under reduced motion. No avatars: a room has N members, so the mark is the run itself.
 */
export function MatchingOrbit({ running }: { running: boolean }) {
  const reduced = useReducedMotion()
  const moving = running && !reduced
  const ping = useLoop(moving, PING_MS, false)
  const pulse = useLoop(moving, PULSE_MS, true)
  const spin = useLoop(moving, SPIN_MS, false)

  const pingStyle = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - ping.get()),
    transform: [{ scale: 1 + 0.3 * ping.get() }],
  }))
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.06 * pulse.get() }] }))
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${360 * spin.get()}deg` }] }))

  return (
    <View testID="matching-orbit" style={styles.orbit} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {moving ? <Animated.View testID="matching-orbit-ping" style={[styles.orbitPing, pingStyle]} /> : null}
      <Animated.View style={[styles.orbitMid, pulseStyle]}>
        <View style={styles.orbitCore}>
          <Animated.View style={spinStyle}>
            <Icon name="compass" size={44} color="accent.onAccent" />
          </Animated.View>
        </View>
      </Animated.View>
      <View style={[styles.satellite, styles.satelliteTop]}>
        <Icon name="mapPin" size={18} color="accent.onSoft" />
      </View>
      <View style={[styles.satellite, styles.satelliteLeft]}>
        <Icon name="heart" size={16} color="accent.onSoft" />
      </View>
      <View style={[styles.satellite, styles.satelliteRight]}>
        <Icon name="star" size={16} color="status.warningText" />
      </View>
    </View>
  )
}
