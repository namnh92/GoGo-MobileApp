import { useEffect } from 'react'
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { useReducedMotion } from './feedback'
import { motion } from './tokens'
import { styles } from './pulse-dot.style'

export function PulseDot() {
  const reduced = useReducedMotion()
  const pulse = useSharedValue(0)
  useEffect(() => {
    pulse.set(reduced ? 0 : withRepeat(withTiming(1, { duration: motion.ping }), -1))
    return () => cancelAnimation(pulse)
  }, [reduced, pulse])
  const animated = useAnimatedStyle(() => ({ opacity: 1 - pulse.get(), transform: [{ scale: 1 + pulse.get() }] }))
  return <Animated.View style={[styles.dot, animated]} />
}
