import { useEffect, useState } from 'react'
import { Pressable } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Ellipse, G, Path, Text as SvgText } from 'react-native-svg'
import { useTranslation } from 'react-i18next'
import { useUnistyles } from 'react-native-unistyles'

import { fontFamily, motion, type } from '@/shared/ui/tokens'

import { styles } from './splash.style'
import {
  VIETNAM_MAP_PATH,
  VIETNAM_MAP_VIEWBOX,
  VIETNAM_MARKERS,
} from './vietnam-map'

/** The map's height for a given width: the outline's own aspect ratio. */
export const mapHeightFor = (width: number) => (width * VIETNAM_MAP_VIEWBOX.height) / VIETNAM_MAP_VIEWBOX.width
/** Stitch labels are 9 viewBox units and scale proportionally with the complete map. */
export const labelFontUnits = (width: number) => {
  if (width <= 0) return 0
  return type.mapLabel.fontSize
}

/** Map entrance uses the splash pacing tokens; minimum visibility is `SPLASH_MIN_MS`. */
export const MAP_FADE_MS = motion.mapReveal
const FIRST_DROP_MS = motion.pinFirstDelay
const DROP_STEP_MS = motion.pinStep
const DROP_MS = motion.pinDrop
const BOUNCE_MS = motion.markerBounce / 2
const RIPPLE_MS = motion.ripple
const DROP_FROM = -40
const BOUNCE_UP = -8

/** A pin with its tip at the origin, drawn as in the draft. */
const PIN_PATH = 'M0 0 C0 0 -6 -6.5 -6 -10.5 C-6 -13.8 -3.3 -16.5 0 -16.5 C3.3 -16.5 6 -13.8 6 -10.5 C6 -6.5 0 0 0 0Z'

function Marker({ index, reduced, width, tap }: { index: number; reduced: boolean; width: number; tap: number }) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const marker = VIETNAM_MARKERS[index]
  const label =
    marker.id === 'hanoi' ? t('splash.city.hanoi') : marker.id === 'danang' ? t('splash.city.danang') : t('splash.city.hcm')
  const scale = width / VIETNAM_MAP_VIEWBOX.width
  const height = mapHeightFor(width)
  const lift = useSharedValue(reduced ? 0 : DROP_FROM * scale)
  const seen = useSharedValue(reduced ? 1 : 0)
  const ripple = useSharedValue(0)

  useEffect(() => {
    if (reduced) {
      cancelAnimation(lift)
      cancelAnimation(seen)
      cancelAnimation(ripple)
      lift.set(0)
      seen.set(1)
      ripple.set(0)
      return
    }
    const delay = FIRST_DROP_MS + index * DROP_STEP_MS
    seen.set(withDelay(delay, withTiming(1, { duration: DROP_MS })))
    lift.set(
      withDelay(
        delay,
        withSequence(
          withTiming(2 * scale, { duration: DROP_MS * 0.7, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: DROP_MS * 0.3 }),
        ),
      ),
    )
    return () => {
      cancelAnimation(lift)
      cancelAnimation(seen)
      cancelAnimation(ripple)
    }
  }, [reduced, index, lift, seen, ripple, scale])

  useEffect(() => {
    if (!tap || reduced) return
    const delay = index * motion.markerBounce / 5
    lift.set(withDelay(delay, withSequence(
      withTiming(BOUNCE_UP * scale, { duration: BOUNCE_MS }),
      withTiming(0, { duration: BOUNCE_MS }),
    )))
    ripple.set(0)
    ripple.set(withDelay(delay, withTiming(1, { duration: RIPPLE_MS, easing: Easing.out(Easing.quad) })))
  }, [tap, reduced, index, lift, ripple, scale])

  const pinStyle = useAnimatedStyle(() => ({ opacity: seen.get(), transform: [{ translateY: lift.get() }] }))
  // One ring per landing: invisible before it starts and again once it has spread.
  const rippleStyle = useAnimatedStyle(() => {
    const p = ripple.get()
    return { opacity: p === 0 || p === 1 ? 0 : 0.5 * (1 - p), transform: [{ scale: 0.5 + 2 * p }] }
  })

  return (
    <>
      <Animated.View
        testID={`splash-ripple-${marker.id}`}
        style={[
          styles.ripple,
          { width: 14 * scale, height: 14 * scale, borderRadius: 7 * scale, left: marker.x * scale - 7 * scale, top: marker.y * scale - 7 * scale },
          rippleStyle,
        ]}
      />
      <Animated.View testID={`splash-pin-${marker.id}`} style={[styles.pin, pinStyle]}>
        <Svg width={width} height={height} viewBox={`0 0 ${VIETNAM_MAP_VIEWBOX.width} ${VIETNAM_MAP_VIEWBOX.height}`}>
          <G transform={`translate(${marker.x} ${marker.y})`}>
            <Ellipse cx={0} cy={0} rx={3.5} ry={1.4} fill={theme.text.primary} fillOpacity={0.12} />
            <Path d={PIN_PATH} fill={theme.accent.primary} />
            <Circle cx={0} cy={-10.5} r={2} fill={theme.text.inverse} />
            <SvgText x={9} y={-7.5} fontFamily={fontFamily.medium} fontSize={labelFontUnits(width)} fill={theme.text.secondary}>
              {label}
            </SvgText>
          </G>
        </Svg>
      </Animated.View>
    </>
  )
}

/**
 * The Vietnam map of the splash: the outline fades in, then three pins drop in
 * order (Hà Nội, Đà Nẵng, TP.HCM). Tapping triggers the staggered bounce/ripple.
 * Under reduced motion it is drawn in its final state without tap animation.
 */
export function SplashMap({ reduced, width }: { reduced: boolean; width: number }) {
  const [tap, setTap] = useState(0)
  const { t } = useTranslation()
  const height = mapHeightFor(width)
  const { theme } = useUnistyles()
  const fade = useSharedValue(reduced ? 1 : 0)

  useEffect(() => {
    if (reduced) {
      cancelAnimation(fade)
      fade.set(1)
      return
    }
    fade.set(withTiming(1, { duration: MAP_FADE_MS }))
    return () => cancelAnimation(fade)
  }, [reduced, fade])

  const mapStyle = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ scale: 0.96 + 0.04 * fade.get() }] }))

  return (
    <Pressable
      onPress={() => setTap(count => count + 1)}
      accessibilityRole="button"
      accessibilityLabel={t('splash.mapLabel')}
      testID="splash-map"
      style={[styles.map, { width, height }]}
    >
      <Animated.View style={mapStyle}>
        <Svg width={width} height={height} viewBox={`0 0 ${VIETNAM_MAP_VIEWBOX.width} ${VIETNAM_MAP_VIEWBOX.height}`}>
          <Path
            d={VIETNAM_MAP_PATH}
            fill={theme.accent.container}
            fillOpacity={0.55}
            stroke={theme.border.hairline}
            strokeWidth={0.5}
            strokeLinejoin="round"
            fillRule="evenodd"
          />
        </Svg>
      </Animated.View>
      {VIETNAM_MARKERS.map((marker, index) => (
        <Marker key={marker.id} index={index} reduced={reduced} width={width} tap={tap} />
      ))}
    </Pressable>
  )
}
