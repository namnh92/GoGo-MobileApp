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
import { motion, spacing } from '@/shared/ui/tokens'

import { SplashMap } from './splash-map.view'
import { Reveal } from './splash-reveal.view'
import { styles } from './splash.style'

/** The animation plays once and the screen holds this long; readiness can only add to it. */
export const SPLASH_MIN_MS = motion.splashHold
/** Stitch reveals the wordmark and line together once the pins are down. */
const LOGO_REVEAL = { delay: motion.brandDelay, duration: motion.brandReveal }
const LINE_REVEAL = LOGO_REVEAL
/** Room kept clear of the map for the logo row, the line and the gap between them. */
const BRAND_RESERVE = 44 + spacing[2] + 22 + spacing[7]
const MAP_ASPECT = 223 / 349

export default function SplashScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { status } = useSession()
  const reducedMotion = useReducedMotion()
  const [minimumElapsed, setMinimumElapsed] = useState(false)
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  // Stitch's 200px map shrinks only when the safe-area space cannot contain it.
  const availableWidth = window.width - spacing[6] * 2
  const availableHeight = window.height - insets.top - insets.bottom - spacing[6] * 2 - BRAND_RESERVE
  const mapWidth = Math.max(0, Math.min(200, availableWidth, availableHeight * MAP_ASPECT))

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
    <Atmosphere redesign glow style={[styles.root, { paddingTop: insets.top + spacing[6], paddingBottom: insets.bottom + spacing[6] }]}>
      <SplashMap reduced={reducedMotion} width={mapWidth} />
      <View testID="splash-brand" style={styles.brand}>
        <Reveal testID="splash-reveal-logo" reduced={reducedMotion} {...LOGO_REVEAL}>
          <Text variant="brand" color="accent.primary" style={styles.wordmark} accessibilityRole="header">{t('splash.brand')}</Text>
        </Reveal>
        <Reveal testID="splash-reveal-line" reduced={reducedMotion} {...LINE_REVEAL}>
          <Text variant="introTagline" color="redesign.ink" style={styles.tagline}>{t('splash.tagline')}</Text>
        </Reveal>
      </View>
    </Atmosphere>
  )
}
