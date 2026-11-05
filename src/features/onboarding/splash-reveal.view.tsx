import { useEffect, type ReactNode } from 'react'
import { View } from 'react-native'
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
 * Shows its children from left to right. The children keep their final layout
 * the whole time: a canvas-coloured cover sits over them and its width shrinks
 * from the right edge, so nothing reflows. Under reduced motion the cover has
 * no width from the first frame.
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

  const coverStyle = useAnimatedStyle(() => ({ width: `${(1 - progress.get()) * 100}%` }))

  return (
    <View style={styles.revealBox}>
      {children}
      <Animated.View testID={testID} pointerEvents="none" style={[styles.revealCover, coverStyle]} />
    </View>
  )
}
