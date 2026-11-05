import { useEffect } from 'react'
import { View } from 'react-native'
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

import { fontFamily } from '@/shared/ui/tokens'

import { styles } from './splash.style'
import {
  VIETNAM_MAP_PATH,
  VIETNAM_MAP_VIEWBOX,
  VIETNAM_MARKERS,
} from './vietnam-map'

/** The draft draws the map 200 wide; the height follows the outline's own ratio. */
const MAP_WIDTH = 200
const SCALE = MAP_WIDTH / VIETNAM_MAP_VIEWBOX.width
const MAP_HEIGHT = Math.round(VIETNAM_MAP_VIEWBOX.height * SCALE)

/** The whole entrance is about 1.2 s; the screen holds for 1.5 s (`SPLASH_MIN_MS`). */
export const MAP_FADE_MS = 350
const FIRST_DROP_MS = 200
const DROP_STEP_MS = 200
const DROP_MS = 180
const BOUNCE_MS = 70
const RIPPLE_MS = 400
const DROP_FROM = -20
const BOUNCE_UP = -4

/** A pin with its tip at the origin, drawn as in the draft. */
const PIN_PATH = 'M0 0 C0 0 -6 -6.5 -6 -10.5 C-6 -13.8 -3.3 -16.5 0 -16.5 C3.3 -16.5 6 -13.8 6 -10.5 C6 -6.5 0 0 0 0Z'

function Marker({ index, reduced }: { index: number; reduced: boolean }) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  const marker = VIETNAM_MARKERS[index]
  const label =
    marker.id === 'hanoi' ? t('splash.city.hanoi') : marker.id === 'danang' ? t('splash.city.danang') : t('splash.city.hcm')
  const lift = useSharedValue(reduced ? 0 : DROP_FROM)
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
          withTiming(0, { duration: DROP_MS, easing: Easing.in(Easing.quad) }),
          withTiming(BOUNCE_UP, { duration: BOUNCE_MS, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: BOUNCE_MS, easing: Easing.in(Easing.quad) }),
        ),
      ),
    )
    ripple.set(withDelay(delay + DROP_MS, withTiming(1, { duration: RIPPLE_MS, easing: Easing.out(Easing.quad) })))
    return () => {
      cancelAnimation(lift)
      cancelAnimation(seen)
      cancelAnimation(ripple)
    }
  }, [reduced, index, lift, seen, ripple])

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
        style={[styles.ripple, { left: marker.x * SCALE - 8, top: marker.y * SCALE - 8 }, rippleStyle]}
      />
      <Animated.View testID={`splash-pin-${marker.id}`} style={[styles.pin, pinStyle]}>
        <Svg width={MAP_WIDTH} height={MAP_HEIGHT} viewBox={`0 0 ${VIETNAM_MAP_VIEWBOX.width} ${VIETNAM_MAP_VIEWBOX.height}`}>
          <G transform={`translate(${marker.x} ${marker.y})`}>
            <Ellipse cx={0} cy={0} rx={3.5} ry={1.4} fill={theme.text.primary} fillOpacity={0.12} />
            <Path d={PIN_PATH} fill={theme.accent.primary} />
            <Circle cx={0} cy={-10.5} r={2} fill={theme.surface.card} />
            <SvgText x={9} y={-7.5} fontFamily={fontFamily.medium} fontSize={9} fill={theme.text.secondary}>
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
 * order (Hà Nội, Đà Nẵng, TP.HCM), each with one small bounce and one ripple.
 * Plays once. Under reduced motion it is drawn in its final state. Decoration:
 * hidden from screen readers.
 */
export function SplashMap({ reduced }: { reduced: boolean }) {
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

  const mapStyle = useAnimatedStyle(() => ({ opacity: fade.get() }))

  return (
    <View
      testID="splash-map"
      style={[styles.map, { width: MAP_WIDTH, height: MAP_HEIGHT }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={mapStyle}>
        <Svg width={MAP_WIDTH} height={MAP_HEIGHT} viewBox={`0 0 ${VIETNAM_MAP_VIEWBOX.width} ${VIETNAM_MAP_VIEWBOX.height}`}>
          <Path
            d={VIETNAM_MAP_PATH}
            fill={theme.accent.soft}
            fillOpacity={0.55}
            stroke={theme.border.hairline}
            strokeWidth={0.5}
            strokeLinejoin="round"
            fillRule="evenodd"
          />
        </Svg>
      </Animated.View>
      {VIETNAM_MARKERS.map((marker, index) => (
        <Marker key={marker.id} index={index} reduced={reduced} />
      ))}
    </View>
  )
}
