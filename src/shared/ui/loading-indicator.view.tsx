import { useEffect, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { type StyleProp, type ViewStyle } from 'react-native'
import Animated, { cancelAnimation, Easing, interpolate, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg'

import { useReducedMotionPreference } from './feedback'
import { brandLogo, loadingIndicator as token, motion } from './tokens'
import { styles } from './loading-indicator.style'

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedG = Animated.createAnimatedComponent(G)
const LOOP = 'M 200,160 C 164,96 92,80 56,124 C 22,168 32,220 120,278 C 152,250 178,208 200,160 C 222,208 248,250 280,278 C 368,220 378,168 344,124 C 308,80 236,96 200,160'

/** Each star has its own clock; reduced motion cancels both clocks. */
function Twinkle({ delay = 0, duration, x, y, color, reduced }: {
  delay?: number; duration: number; x: number; y: number; color: string; reduced: boolean
}) {
  const pulse = useSharedValue(0)
  useEffect(() => {
    cancelAnimation(pulse)
    pulse.set(0)
    if (!reduced) pulse.set(withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1)))
    return () => cancelAnimation(pulse)
  }, [reduced, delay, duration, pulse])
  const props = useAnimatedProps(() => {
    const scale = reduced ? 1 : interpolate(pulse.get(), [0, 0.5, 1], [0.8, 1.15, 0.8])
    return {
      opacity: reduced ? 0.9 : interpolate(pulse.get(), [0, 0.5, 1], [0.4, 1, 0.4]),
      matrix: [scale, 0, 0, scale, 0, 0],
    }
  })
  return <G x={x} y={y}><AnimatedG animatedProps={props}><Path d="M 0,-12 Q 0,0 -9,0 Q 0,0 0,12 Q 0,0 9,0 Q 0,0 0,-12 Z" fill={color} /></AnimatedG></G>
}

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

/** Stitch option A: mark only, traveling beam, gentle bounce and twin stars. */
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
      const easing = Easing.bezier(0.28, 0.84, 0.42, 1)
      bounce.set(withRepeat(withSequence(
        withTiming(-7, { duration: motion.loadingBounce * 0.32, easing }),
        withTiming(-2, { duration: motion.loadingBounce * 0.16, easing }),
        withTiming(-5, { duration: motion.loadingBounce * 0.16, easing }),
        withTiming(0, { duration: motion.loadingBounce * 0.36, easing }),
      ), -1))
      beam.set(withRepeat(withTiming(1, { duration: motion.loadingBeam, easing: Easing.bezier(0.42, 0, 0.58, 1) }), -1))
    }
    return () => { cancelAnimation(bounce); cancelAnimation(beam) }
  }, [reduced, bounce, beam])
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: reduced ? 0 : bounce.get() * size / token.size }],
  }))
  const beamProps = useAnimatedProps(() => ({ strokeDashoffset: reduced ? 0 : 760 * (1 - beam.get()) }))
  return (
    <Animated.View testID={testID} accessible={!decorative} accessibilityRole={decorative ? undefined : 'progressbar'}
      accessibilityLabel={decorative ? undefined : accessibilityLabel ?? t('common.loading')}
      accessibilityState={decorative ? undefined : { busy: true }}
      importantForAccessibility={decorative ? 'no' : 'auto'} style={[styles.mark, { width: size, height: size }, animated, style]}>
      <Svg width={size} height={size} viewBox="0 0 400 320" fill="none" accessible={false}>
        <Defs>
          <LinearGradient id={`${id}-spectrum`} x1="0%" x2="100%" y1="60%" y2="40%">
            {brandLogo.spectrum.map((color, i) => <Stop key={color} offset={brandLogo.offsets[i]} stopColor={color} />)}
          </LinearGradient>
        </Defs>
        <Twinkle x={200} y={65} duration={2400} color={brandLogo.sparkleMint} reduced={reduced} />
        <Twinkle x={337} y={106} duration={2800} delay={500} color={brandLogo.sparkleAmber} reduced={reduced} />
        <G strokeLinecap="round" strokeLinejoin="round" fill="none">
          <Path d={`${LOOP} Z`} stroke={`url(#${id}-spectrum)`} strokeWidth={42} />
          {/* Wider translucent copies give the beam a native SVG glow. */}
          <AnimatedPath d={LOOP} stroke={brandLogo.sheen} opacity={0.12} strokeWidth={19} strokeDasharray="85 255" animatedProps={beamProps} />
          <AnimatedPath d={LOOP} stroke={brandLogo.sheen} opacity={0.25} strokeWidth={12} strokeDasharray="85 255" animatedProps={beamProps} />
          <AnimatedPath testID={`${testID}-beam`} d={LOOP} stroke={brandLogo.sheen} strokeWidth={7} strokeDasharray="85 255" animatedProps={beamProps} />
        </G>
      </Svg>
    </Animated.View>
  )
}
