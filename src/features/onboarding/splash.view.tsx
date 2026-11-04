import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Animated, View } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import Svg, { Circle, Path } from 'react-native-svg'

import { useSession } from '@/shared/providers/session-provider'
import { hasCompletedOnboarding, markOnboardingComplete } from '@/shared/storage/onboarding'

import { useReducedMotion } from '@/shared/ui/feedback'
import { Glyph, Text } from '@/shared/ui/text'
import { motion } from '@/shared/ui/tokens'

import { styles } from './splash.style'

const SPLASH_MS = 2200

export default function SplashScreen() {
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const router = useRouter()
  const { status } = useSession()
  const reducedMotion = useReducedMotion()
  const [minimumElapsed, setMinimumElapsed] = useState(false)

  // Lazy initialiser, not a ref: the value must survive re-renders without
  // being read during render.
  const [entrance] = useState(() => new Animated.Value(0))

  useEffect(() => {
    const timer = setTimeout(() => setMinimumElapsed(true), SPLASH_MS)
    return () => clearTimeout(timer)
  }, [])

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
    // Reduced motion gets the finished state immediately — a cut, not a slower
    // fade. Everyone else gets one settle, which is the whole animation.
    Animated.timing(entrance, {
      toValue: 1,
      duration: reducedMotion ? 0 : motion.slow,
      useNativeDriver: true,
    }).start()
  }, [entrance, reducedMotion])

  const rise = entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] })
  const settle = entrance.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] })

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Animated.View
          // The wordmark is the accessible name; the mark above it is decoration.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.logoBox, { opacity: entrance, transform: [{ scale: settle }] }]}
        >
          <Svg width={36} height={36} viewBox="0 0 42 42" fill="none">
            <Circle cx={14} cy={21} r={9} fill={theme.accent.primary} />
            <Circle cx={28} cy={21} r={9} fill={theme.accent.primary} opacity={0.6} />
            <Path
              d="M21 14 C17 14, 14 17, 14 21 C14 25, 17 28, 21 28 C25 28, 28 25, 28 21 C28 17, 25 14, 21 14Z"
              fill={theme.accent.soft}
            />
          </Svg>
        </Animated.View>

        <Animated.View style={[styles.textBlock, { opacity: entrance, transform: [{ translateY: rise }] }]}>
          <Glyph size="xl" color="accent.primary" style={styles.wordmark} accessibilityRole="header">GoGo</Glyph>
          <Text color="text.secondary" style={styles.tagline}>{t('splash.tagline')}</Text>
        </Animated.View>
      </View>
    </View>
  )
}
