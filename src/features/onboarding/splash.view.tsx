import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUnistyles } from 'react-native-unistyles'
import Svg, { Circle, Path } from 'react-native-svg'

import { useSession } from '@/shared/providers/session-provider'
import { hasCompletedOnboarding, markOnboardingComplete } from '@/shared/storage/onboarding'

import { useReducedMotion } from '@/shared/ui/feedback'
import { Glyph, Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { SplashMap } from './splash-map.view'
import { Reveal } from './splash-reveal.view'
import { styles } from './splash.style'

/** The animation plays once and the screen holds this long; readiness can only add to it. */
export const SPLASH_MIN_MS = 1500
/** The logo and wordmark, then the line, are revealed left to right once the pins are down. */
const LOGO_REVEAL = { delay: 650, duration: 350 }
const LINE_REVEAL = { delay: 800, duration: 400 }
/** Room kept clear of the map for the logo row, the line and the gap between them. */
const BRAND_RESERVE = 56 + spacing[2] + 22 + spacing[5]
const MAP_ASPECT = 223 / 349

export default function SplashScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { status } = useSession()
  const reducedMotion = useReducedMotion()
  const [minimumElapsed, setMinimumElapsed] = useState(false)
  const { theme } = useUnistyles()
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  // The map fills the height left by the safe areas, a margin and the brand block,
  // and is never wider than the screen less the margin. Aspect ratio is kept.
  const availableWidth = window.width - spacing[6] * 2
  const availableHeight = window.height - insets.top - insets.bottom - spacing[6] * 2 - BRAND_RESERVE
  const mapWidth = Math.floor(Math.max(0, Math.min(availableWidth, availableHeight * MAP_ASPECT)))

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
    <View style={[styles.root, { paddingTop: insets.top + spacing[6], paddingBottom: insets.bottom + spacing[6] }]}>
      <SplashMap reduced={reducedMotion} width={mapWidth} />
      <View testID="splash-brand" style={styles.brand}>
        <Reveal testID="splash-reveal-logo" reduced={reducedMotion} {...LOGO_REVEAL}>
          <View style={styles.logoRow}>
            <View
              // The wordmark is the accessible name; the mark is decoration.
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.logoBox}
            >
              <Svg width={36} height={36} viewBox="0 0 42 42" fill="none">
                <Circle cx={14} cy={21} r={9} fill={theme.accent.primary} />
                <Circle cx={28} cy={21} r={9} fill={theme.accent.primary} opacity={0.6} />
                <Path
                  d="M21 14 C17 14, 14 17, 14 21 C14 25, 17 28, 21 28 C25 28, 28 25, 28 21 C28 17, 25 14, 21 14Z"
                  fill={theme.accent.soft}
                />
              </Svg>
            </View>
            <Glyph size="xl" color="accent.primary" style={styles.wordmark} accessibilityRole="header">GoGo</Glyph>
          </View>
        </Reveal>
        <Reveal testID="splash-reveal-line" reduced={reducedMotion} {...LINE_REVEAL}>
          <Text variant="title2" color="text.primary" style={styles.tagline}>{t('splash.tagline')}</Text>
        </Reveal>
      </View>
    </View>
  )
}
