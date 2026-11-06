import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useSession } from '@/shared/providers/session-provider'
import { hasCompletedOnboarding, markOnboardingComplete } from '@/shared/storage/onboarding'

import { useReducedMotion } from '@/shared/ui/feedback'
import { Text } from '@/shared/ui/text'
import { Atmosphere } from '@/shared/ui/primitives'
import { motion, spacing, type } from '@/shared/ui/tokens'

import { SplashMap } from './splash-map.view'
import { Reveal } from './splash-reveal.view'
import { styles } from './splash.style'

/** The animation plays once and the screen holds this long; readiness can only add to it. */
export const SPLASH_MIN_MS = motion.splashHold
/** Stitch reveals the wordmark and line together once the pins are down. */
const LOGO_REVEAL = { delay: motion.brandDelay, duration: motion.brandReveal }
const LINE_REVEAL = LOGO_REVEAL

export default function SplashScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { status } = useSession()
  const reducedMotion = useReducedMotion()
  const [minimumElapsed, setMinimumElapsed] = useState(false)
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  // Reduced motion shows the final state and holds for no minimum at all.
  const minimumMs = reducedMotion ? 0 : SPLASH_MIN_MS
  useEffect(() => {
    const timer = setTimeout(() => setMinimumElapsed(true), minimumMs)
    return () => clearTimeout(timer)
  }, [minimumMs])

  useEffect(() => {
    if (!minimumElapsed || status === 'hydrating') return
    let cancelled = false
    if (status === 'user' || status === 'guest') {
      // An existing account may predate onboarding storage. Preserve the
      // once-per-install contract after that account signs out.
      void markOnboardingComplete()
      router.replace('/(tabs)')
      return
    }
    void hasCompletedOnboarding().then(completed => {
      if (!cancelled) router.replace(completed ? '/(tabs)' : '/onboarding')
    })
    return () => { cancelled = true }
  }, [minimumElapsed, router, status])

  return (
    <Atmosphere redesign glow style={[styles.root, { paddingTop: insets.top + spacing[6], paddingBottom: insets.bottom + spacing[6], paddingLeft: insets.left + spacing[6], paddingRight: insets.right + spacing[6] }]}>
      <SplashComposition key={`${window.width}:${window.height}:${window.fontScale}:${insets.top}:${insets.bottom}:${insets.left}:${insets.right}:${t('splash.tagline')}`} reduced={reducedMotion}
        width={window.width - insets.left - insets.right - spacing[6] * 2}
        height={window.height - insets.top - insets.bottom - spacing[6] * 2} fontScale={window.fontScale} />
    </Atmosphere>
  )
}

/** Brand stays in its final constrained layout throughout the reveal. */
function SplashComposition({ reduced, width, height, fontScale }: { reduced: boolean; width: number; height: number; fontScale: number }) {
  const { t } = useTranslation()
  const [size, setSize] = useState({ width, height })
  const [brandHeight, setBrandHeight] = useState((type.brand.lineHeight + spacing[2] + type.introTagline.lineHeight * 2) * fontScale)
  // The half-point SVG stroke needs 0.25 units on each side. Pin drop starts
  // at 51.4 - 16.5 - 40 = -5.1, but is fully transparent there; reserve its
  // complete travel anyway. Other markers, labels and ripples stay in viewBox.
  const topReserve = 5.1
  const scale = Math.max(0, Math.min(size.width / 223.5, (size.height - brandHeight - spacing[7]) / (349.5 + topReserve)))
  return <View testID="splash-layout" style={styles.composition} onLayout={event => {
    const { width, height } = event.nativeEvent.layout
    if (width > 0 && height > 0) setSize(previous => previous.width === width && previous.height === height ? previous : { width, height })
  }}>
    <View style={{ paddingTop: (topReserve + 0.25) * scale, paddingBottom: 0.25 * scale }}>
      <SplashMap reduced={reduced} width={223 * scale} />
    </View>
    <View testID="splash-brand" style={styles.brand} onLayout={event => {
      const { height } = event.nativeEvent.layout
      if (height > 0) setBrandHeight(previous => previous === height ? previous : height)
    }}>
      <Reveal testID="splash-reveal-logo" reduced={reduced} {...LOGO_REVEAL}>
        <Text variant="brand" color="accent.primary" style={styles.wordmark} accessibilityRole="header">{t('splash.brand')}</Text>
      </Reveal>
      <Reveal testID="splash-reveal-line" reduced={reduced} {...LINE_REVEAL}>
        <Text variant="introTagline" color="redesign.ink" style={styles.tagline}>{t('splash.tagline')}</Text>
      </Reveal>
    </View>
  </View>
}
