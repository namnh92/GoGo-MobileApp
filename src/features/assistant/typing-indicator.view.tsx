import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { useReducedMotionPreference } from '@/shared/ui/feedback'
import { Text } from '@/shared/ui/text'
import { motion } from '@/shared/ui/tokens'

import { styles } from './typing-indicator.style'

/**
 * Design system `TypingIndicator`: three pulsing dots and what the assistant
 * is doing now ("Checking GoGo guides…"). The label is a polite live region,
 * so a screen reader hears each new step; the dots are decoration, hidden from
 * it, and stand still under reduced motion (or before the OS has said).
 */
export function TypingIndicator({ label }: { label: string }) {
  const reduced = useReducedMotionPreference() ?? true
  return (
    <View testID="assistant-typing" style={styles.row}>
      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1, 2].map(index => (
          <Dot key={index} index={index} still={reduced} />
        ))}
      </View>
      <Text variant="bodySmall" color="text.secondary" accessibilityLiveRegion="polite" accessibilityRole="text">
        {label}
      </Text>
    </View>
  )
}

function Dot({ index, still }: { index: number; still: boolean }) {
  const lift = useSharedValue(0)
  useEffect(() => {
    if (still) {
      cancelAnimation(lift)
      lift.set(0)
      return
    }
    lift.set(
      withDelay(
        index * motion.fast,
        withRepeat(withSequence(withTiming(1, { duration: motion.standard }), withTiming(0, { duration: motion.standard })), -1),
      ),
    )
    return () => cancelAnimation(lift)
  }, [still, index, lift])
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: -3 * lift.get() }] }))
  return <Animated.View style={[styles.dot, !still && animated]} />
}
