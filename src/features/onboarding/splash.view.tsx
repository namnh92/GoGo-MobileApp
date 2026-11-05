import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

import { useSession } from '@/shared/providers/session-provider'
import { hasCompletedOnboarding, markOnboardingComplete } from '@/shared/storage/onboarding'

import { useReducedMotion } from '@/shared/ui/feedback'
import { Glyph, Text } from '@/shared/ui/text'
import { motion } from '@/shared/ui/tokens'

import { SplashMap } from './splash-map.view'
import { styles } from './splash.style'

/** The animation plays once and the screen holds this long; readiness can only add to it. */
export const SPLASH_MIN_MS = 1500
/** The wordmark and tagline arrive once the pins have landed. */
const BRAND_DELAY_MS = 800

export default function SplashScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { status } = useSession()
  const reducedMotion = useReducedMotion()
  const [minimumElapsed, setMinimumElapsed] = useState(false)
  const reveal = useSharedValue(reducedMotion ? 1 : 0)

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

  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(reveal)
      reveal.set(1)
      return
    }
    reveal.set(withDelay(BRAND_DELAY_MS, withTiming(1, { duration: motion.standard })))
    return () => cancelAnimation(reveal)
  }, [reveal, reducedMotion])

  const brandStyle = useAnimatedStyle(() => ({ opacity: reveal.get() }))

  return (
    <View style={styles.root}>
      <SplashMap reduced={reducedMotion} />
      <Animated.View testID="splash-brand" style={[styles.textBlock, brandStyle]}>
        <Glyph size="xl" color="accent.primary" style={styles.wordmark} accessibilityRole="header">GoGo</Glyph>
        <Text variant="title2" color="text.primary" style={styles.tagline}>{t('splash.tagline')}</Text>
      </Animated.View>
    </View>
  )
}
