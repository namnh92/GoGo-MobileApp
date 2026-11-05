import { useEffect } from 'react'
import { View, type ViewStyle } from 'react-native'
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
/** One turn of the outer ring, as in the draft. */
const SPIN_MS = 3000

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

type BubbleProps = {
  name: 'mapPin' | 'heart' | 'star'
  size: number
  color: 'accent.onSoft' | 'status.warningText'
  spin: SharedValue<number>
  style: ViewStyle
}

/** An icon bubble on the ring. It turns back by what the ring turned, so it rides the ring but stays upright. */
function Bubble({ name, size, color, spin, style }: BubbleProps) {
  const upright = useAnimatedStyle(() => ({ transform: [{ rotate: `${-360 * spin.get()}deg` }] }))
  return (
    <Animated.View testID={`matching-orbit-bubble-${name}`} style={[styles.satellite, style, upright]}>
      <Icon name={name} size={size} color={color} />
    </Animated.View>
  )
}

/**
 * The mark of the run, as the "Đang ghép" draft moves it: a ring spreading out, a
 * ring breathing, the centre still, and the outer ring turning evenly with its icon
 * bubbles kept upright. Decoration only, hidden from screen readers. Still when
 * nothing is running, and under reduced motion. No avatars: a room has N members,
 * so the mark is the run itself.
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
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${360 * spin.get()}deg` }] }))

  return (
    <View testID="matching-orbit" style={styles.orbit} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {moving ? <Animated.View testID="matching-orbit-ping" style={[styles.orbitPing, pingStyle]} /> : null}
      <Animated.View style={[styles.orbitMid, pulseStyle]}>
        <View style={styles.orbitCore}>
          <Icon name="compass" size={44} color="accent.onAccent" />
        </View>
      </Animated.View>
      <Animated.View testID="matching-orbit-ring" style={[styles.orbitRing, ringStyle]}>
        <Bubble name="mapPin" size={18} color="accent.onSoft" spin={spin} style={styles.satelliteTop} />
        <Bubble name="heart" size={16} color="accent.onSoft" spin={spin} style={styles.satelliteLeft} />
        <Bubble name="star" size={16} color="status.warningText" spin={spin} style={styles.satelliteRight} />
      </Animated.View>
    </View>
  )
}
