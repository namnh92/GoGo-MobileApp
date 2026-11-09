import { useEffect, type ComponentProps, type ReactNode } from 'react'
import Animated, {
  cancelAnimation, Easing, interpolate, useAnimatedProps, useSharedValue,
  withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated'
import { Circle, G, Path } from 'react-native-svg'

import { logoPaths } from './gogo-logo.asset'
import { brandLogo, motion } from './tokens'

const AnimatedG = Animated.createAnimatedComponent(G<{ matrix?: number[] }>)
const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const bounceEase = Easing.bezier(...motion.logoBounceEasing).factory()
const pulseEase = Easing.bezier(...motion.logoPulseEasing).factory()

/** Mounted only for animated artwork; unmount cancels every UI-thread loop. */
function useCycle(duration: number, delay = 0) {
  const phase = useSharedValue(delay > 0 ? -1 : 0)
  useEffect(() => {
    const loop = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false)
    // CSS delay has no backwards fill: preserve the base artwork until it starts.
    phase.set(delay > 0
      ? withDelay(delay, withSequence(withTiming(0, { duration: motion.instant }), loop))
      : loop)
    return () => cancelAnimation(phase)
  }, [phase, duration, delay])
  return phase
}

// CSS applies easing separately between each keyframe, rather than once per loop.
function bounceAt(phase: number) {
  'worklet'
  const times = [0, 0.32, 0.48, 0.64, 1]
  const values = [0, -7, -2, -5, 0]
  for (let i = 1; i < times.length; i++) {
    if (phase <= times[i]) {
      return values[i - 1] + (values[i] - values[i - 1]) * bounceEase((phase - times[i - 1]) / (times[i] - times[i - 1]))
    }
  }
  return 0
}

export function BouncingRibbon({ children, testID }: { children: ReactNode; testID: string }) {
  const phase = useCycle(motion.logoBounce)
  const props = useAnimatedProps(() => ({ matrix: [1, 0, 0, 1, 0, bounceAt(phase.get())] }))
  return <AnimatedG testID={testID} animatedProps={props}>{children}</AnimatedG>
}

export function LogoBeam({ animated, testID }: { animated: boolean; testID: string }) {
  return animated ? <StreamingBeam testID={testID} /> : <Beam testID={testID} />
}

function Beam({ testID, animatedProps }: { testID: string; animatedProps?: Partial<ComponentProps<typeof Path>> }) {
  return <G>
    {/* Portable glow: a wider translucent stroke follows the exact same dash. */}
    <AnimatedPath testID={`${testID}-glow`} d={logoPaths.beam} stroke={brandLogo.highlight} strokeWidth={14} opacity={0.2} strokeLinecap="round" strokeDasharray="85 255" animatedProps={animatedProps} />
    <AnimatedPath testID={testID} d={logoPaths.beam} stroke={brandLogo.highlight} strokeWidth={7} strokeLinecap="round" strokeDasharray="85 255" animatedProps={animatedProps} />
  </G>
}

function StreamingBeam({ testID }: { testID: string }) {
  const phase = useCycle(motion.logoBeam)
  const props = useAnimatedProps(() => ({ strokeDashoffset: 760 * (1 - pulseEase(phase.get())) }))
  return <Beam testID={testID} animatedProps={props} />
}

export function TwinkleStar({ index, testID }: { index: number; testID: string }) {
  const phase = useCycle(index === 0 ? motion.logoStarFirst : motion.logoStarSecond, index === 0 ? 0 : motion.logoStarDelay)
  const x = index === 0 ? 200 : 324
  const y = index === 0 ? 44 : 54
  const props = useAnimatedProps(() => {
    const p = phase.get()
    if (p < 0) return { opacity: 0.9, matrix: [1, 0, 0, 1, 0, 0] }
    const pulse = pulseEase(p <= 0.5 ? p * 2 : (1 - p) * 2)
    const scale = interpolate(pulse, [0, 1], [0.85, 1.15])
    const angle = pulse * Math.PI / 4
    const a = scale * Math.cos(angle)
    const b = scale * Math.sin(angle)
    // SVG affine matrix rotates and scales around the star's own centre.
    return { opacity: 0.6 + pulse * 0.4, matrix: [a, b, -b, a, x - a * x + b * y, y - b * x - a * y] }
  })
  return <AnimatedPath testID={testID} d={logoPaths.optionBStars[index]} fill={brandLogo.stars[index]} animatedProps={props} />
}

export function WavingDot({ index, testID }: { index: number; testID: string }) {
  const phase = useCycle(motion.logoDot, index * motion.logoDotDelay)
  const props = useAnimatedProps(() => {
    const p = phase.get()
    if (p < 0) return { cy: 354, opacity: 1 }
    const pulse = pulseEase(p <= 0.5 ? p * 2 : (1 - p) * 2)
    return { cy: 354 - pulse * 3, opacity: 0.4 + pulse * 0.6 }
  })
  return <AnimatedCircle testID={testID} cx={180 + index * 20} cy={354} r={3.8} fill={brandLogo.dots[index]} animatedProps={props} />
}
