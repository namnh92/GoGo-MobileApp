import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { pushPermission } from '@/shared/notifications/permission-bootstrap'
import type { MessageKey } from '@/shared/i18n/types'
import { Atmosphere, GhostBtn, GlassCard, PrimaryBtn, ProgressDots } from '@/shared/ui/primitives'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './onboarding.style'

interface Slide {
  emoji: string
  titleKey: MessageKey
  bodyKey: MessageKey
}

const slides: Slide[] = [
  { emoji: '🤔', titleKey: 'onboarding.slide1.title', bodyKey: 'onboarding.slide1.body' },
  { emoji: '👤', titleKey: 'onboarding.slide2.title', bodyKey: 'onboarding.slide2.body' },
  { emoji: '✨', titleKey: 'onboarding.slide3.title', bodyKey: 'onboarding.slide3.body' },
]

const slideChips = [
  ['Ăn ngon', 'Chill', 'Creative'],
  ['🍣 Japanese', '🎨 Creative', '😌 Chill'],
  ['🍣 Dinner · 450k', '🎨 Pottery · 300k', '🍰 Dessert · 100k'],
]

export default function OnboardingScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [slide, setSlide] = useState(0)
  const current = slides[slide]
  const isLast = slide === slides.length - 1

  const [finishing, setFinishing] = useState(false)
  async function finish() {
    if (finishing) return
    setFinishing(true)
    try {
      await AsyncStorage.setItem('gogo.onboarding.v1', '1')
      await pushPermission.request()
      router.replace('/(tabs)')
    } catch {
      setFinishing(false)
    }
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top + spacing[3], alignItems: 'flex-end', paddingHorizontal: spacing[6] }}>
        <Pressable disabled={finishing} onPress={finish} accessibilityRole="button">
          <Text style={styles.skip}>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <GlassCard style={styles.visual}>
          <View style={styles.chipRow}>
            {slideChips[slide].map((chip, i) => (
              <View key={chip} style={[styles.chip, i % 2 === 0 ? styles.chipCoral : styles.chipGlass]}>
                <Text style={[styles.chipLabel, i % 2 === 0 ? { color: colors.neutral[0] } : { color: colors.neutral[900] }]}>{chip}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
        <Text style={styles.emoji}>{current.emoji}</Text>
        <Text style={styles.title}>{t(current.titleKey)}</Text>
        <Text style={styles.slideBody}>{t(current.bodyKey)}</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[6] }]}>
        <View style={{ alignItems: 'center', marginBottom: spacing[3] }}>
          <ProgressDots total={slides.length} current={slide} />
        </View>
        <PrimaryBtn
          loading={finishing}
          label={isLast ? t('onboarding.start') : t('onboarding.next')}
          onPress={() => (isLast ? finish() : setSlide(slide + 1))}
        />
        {isLast && <GhostBtn disabled={finishing} label={t('onboarding.guest')} onPress={finish} />}
      </View>
    </Atmosphere>
  )
}
