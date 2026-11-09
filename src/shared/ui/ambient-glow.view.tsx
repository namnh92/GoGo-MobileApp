import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg'
import { useUnistyles } from 'react-native-unistyles'
import { useReducedMotion } from './feedback'
import { motion } from './tokens'
import { styles } from './ambient-glow.style'

type Variant = 'splash' | 'debate' | 'swipe' | 'plan'
function Orb({ variant, cool = false, green = false }: { variant: Variant; cool?: boolean; green?: boolean }) {
  const { theme } = useUnistyles()
  const reduced = useReducedMotion()
  const drift = useSharedValue(0)
  const animatedOrb = variant === 'splash' && !green
  useEffect(() => {
    drift.set(reduced || !animatedOrb ? 0 : withRepeat(withTiming(1, {
      duration: cool ? motion.ambientCool / 2 : motion.ambientWarm / 2, easing: Easing.inOut(Easing.ease),
    }), -1, true))
    return () => cancelAnimation(drift)
  }, [reduced, cool, animatedOrb, drift])
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: drift.get() * 10 }, { translateY: drift.get() * -12 }, { scale: 1 + drift.get() * 0.05 }],
  }))
  const color = green ? theme.status.success : variant === 'debate'
    ? cool ? theme.status.infoText : theme.accent.primaryDeep
    : cool ? (variant === 'plan' || variant === 'swipe' ? theme.status.infoSoft : theme.status.info) : theme.accent.glow
  const opacity = green ? 0.1 : variant === 'debate' ? 0.05 : variant === 'swipe' ? cool ? 0.4 : 0.3 : variant === 'plan' ? cool ? 0.4 : 0.5 : cool ? 0.15 : 0.5
  const position = green ? styles.green : variant === 'splash' ? cool ? styles.cool : styles.warm
    : variant === 'swipe' ? cool ? styles.swipeCool : styles.swipeWarm
    : cool ? (variant === 'plan' ? styles.cardTop : styles.cardBottom) : (variant === 'plan' ? styles.cardBottom : styles.cardTop)
  return <Animated.View style={[styles.orb, position, animated]}>
    <Svg width="100%" height="100%" viewBox="0 0 400 400">
      <Defs><RadialGradient id="glow"><Stop offset="0" stopColor={color} stopOpacity={opacity} /><Stop offset="1" stopColor={color} stopOpacity={0} /></RadialGradient></Defs>
      <Rect width={400} height={400} fill="url(#glow)" />
    </Svg>
  </Animated.View>
}

/** Screen-specific glow counts and placement; only S63's two outer orbs drift. */
export function AmbientGlow({ variant = 'splash' }: { variant?: Variant }) {
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.fill}>
    <Orb variant={variant} /><Orb variant={variant} cool />{variant === 'splash' && <Orb variant={variant} green />}
  </View>
}
