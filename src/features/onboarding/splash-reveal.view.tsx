import { useEffect, type ReactNode } from 'react'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { styles } from './splash.style'

type RevealProps = {
  children: ReactNode
  delay: number
  duration: number
  reduced: boolean
  testID?: string
}

/**
 * Stitch wordmark entrance: fade and 14px upward reveal, final state when reduced.
 */
export function Reveal({ children, delay, duration, reduced, testID }: RevealProps) {
  const progress = useSharedValue(reduced ? 1 : 0)

  useEffect(() => {
    if (reduced) {
      cancelAnimation(progress)
      progress.set(1)
      return
    }
    progress.set(withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.quad) })))
    return () => cancelAnimation(progress)
  }, [reduced, delay, duration, progress])

  const revealStyle = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ translateY: 14 * (1 - progress.get()) }] }))

  return (
    <Animated.View testID={testID} style={[styles.revealBox, revealStyle]}>
      {children}
    </Animated.View>
  )
}
