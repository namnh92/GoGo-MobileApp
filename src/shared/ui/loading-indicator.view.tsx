import { useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { type StyleProp, type ViewStyle } from 'react-native'
import Animated, { cancelAnimation, Easing, interpolate, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg'

import { useReducedMotionPreference } from './feedback'
import { loadingIndicator as token, motion } from './tokens'
import { styles } from './loading-indicator.style'

const AnimatedPath = Animated.createAnimatedComponent(Path)
const LOOP = 'M 24,24 C 19.6,16 11,14 6.7,19.4 C 2.6,24.8 3.8,31.2 14.4,38.3 C 18.2,34.9 21.3,29.8 24,24 C 26.7,29.8 29.8,34.9 33.6,38.3 C 44.2,31.2 45.4,24.8 41.3,19.4 C 37,14 28.4,16 24,24'

export interface LoadingIndicatorProps {
  size?: number
  /** The sheet uses the same transparent spectrum artwork on all three grounds. */
  variant?: 'light' | 'dark' | 'brand'
  accessibilityLabel?: string
  /** Buttons/labelled loading containers already announce their busy state. */
  decorative?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

/** Native SVG translation of Stitch ANIMATION_264. Never rotates the pin pair. */
export function LoadingIndicator({ size = token.size, accessibilityLabel, decorative = false, style, testID = 'loading-indicator' }: LoadingIndicatorProps) {
  const { t } = useTranslation()
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const reduced = useReducedMotionPreference() !== false
  const bounce = useSharedValue(0)
  const beam = useSharedValue(0)
  useEffect(() => {
    cancelAnimation(bounce)
    cancelAnimation(beam)
    bounce.set(0)
    beam.set(0)
    if (!reduced) {
      bounce.set(withRepeat(withTiming(1, { duration: motion.loadingBounce, easing: Easing.linear }), -1))
      beam.set(withRepeat(withTiming(1, { duration: motion.loadingBeam, easing: Easing.inOut(Easing.ease) }), -1))
    }
    return () => { cancelAnimation(bounce); cancelAnimation(beam) }
  }, [reduced, bounce, beam])
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: reduced ? 0 : interpolate(bounce.get(), [0, 0.32, 0.48, 0.64, 1], [0, -2.5, -0.8, -1.8, 0]) * size / token.size }],
  }))
  const beamProps = useAnimatedProps(() => ({ strokeDashoffset: reduced ? 0 : 80 * (1 - beam.get()) }))
  return (
    <Animated.View testID={testID} accessible={!decorative} accessibilityRole={decorative ? undefined : 'progressbar'}
      accessibilityLabel={decorative ? undefined : accessibilityLabel ?? t('common.loading')}
      accessibilityState={decorative ? undefined : { busy: true }}
      importantForAccessibility={decorative ? 'no' : 'auto'} style={[styles.mark, { width: size, height: size }, animated, style]}>
      <Svg width={size} height={size} viewBox="0 0 48 48" fill="none" accessible={false}>
        <Defs>
          <LinearGradient id={`${id}-spectrum`} x1="0%" x2="100%" y1="60%" y2="40%">
            {token.spectrum.map((color, i) => <Stop key={color} offset={token.offsets[i]} stopColor={color} />)}
          </LinearGradient>
          <LinearGradient id={`${id}-bridge`} x1="0%" x2="100%" y1="100%" y2="0%">
            {token.bridge.map((color, i) => <Stop key={color} offset={['0%', '28%', '50%', '72%', '100%'][i]} stopColor={color} stopOpacity={[0, 0.95, 1, 0.95, 0][i]} />)}
          </LinearGradient>
        </Defs>
        <Path d="M 24,9 Q 24,11 22.5,11 Q 24,11 24,13 Q 24,11 25.5,11 Q 24,11 24,9 Z" fill={token.sparkleMint} opacity={0.9} />
        <Path d="M 40.5,14 Q 40.5,15.5 39.5,15.5 Q 40.5,15.5 40.5,17 Q 40.5,15.5 41.5,15.5 Q 40.5,15.5 40.5,14 Z" fill={token.sparkleAmber} opacity={0.95} />
        <G strokeLinecap="round" strokeLinejoin="round" fill="none">
          <Path d={`${LOOP} Z`} stroke={`url(#${id}-spectrum)`} strokeWidth={5.5} />
          <Path d="M 21.2,28.3 C 22.8,25.6 25,22.4 26.8,19.7" stroke={`url(#${id}-bridge)`} strokeWidth={5.5} />
          <Path d="M 8.6,18.2 C 11.2,15.8 17,15.8 21.4,21" stroke={token.sheen} opacity={0.45} strokeWidth={1.1} />
          <Path d="M 26.6,21 C 31,15.8 36.8,15.8 39.4,18.2" stroke={token.sheen} opacity={0.45} strokeWidth={1.1} />
          <AnimatedPath testID={`${testID}-beam`} d={LOOP} stroke={token.sheen} opacity={0.95} strokeWidth={1.2} strokeDasharray="12 36" animatedProps={beamProps} />
        </G>
      </Svg>
    </Animated.View>
  )
}
