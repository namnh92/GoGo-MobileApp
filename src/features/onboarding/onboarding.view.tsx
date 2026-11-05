import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { pushPermission } from '@/shared/notifications/permission-bootstrap'
import { markOnboardingComplete } from '@/shared/storage/onboarding'
import type { MessageKey } from '@/shared/i18n/types'
import { Atmosphere, GhostBtn, PrimaryBtn, ProgressDots } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'
import { OnboardingVisual } from './onboarding-visual.view'
import { styles } from './onboarding.style'

interface Slide {
  titleKey: MessageKey
  bodyKey: MessageKey
}

const slides: Slide[] = [
  { titleKey: 'onboarding.slide1.title', bodyKey: 'onboarding.slide1.body' },
  { titleKey: 'onboarding.slide2.title', bodyKey: 'onboarding.slide2.body' },
  { titleKey: 'onboarding.slide3.title', bodyKey: 'onboarding.slide3.body' },
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
    await markOnboardingComplete()
    await pushPermission.request().catch(() => undefined)
    router.replace('/(tabs)')
  }

  return (
    <Atmosphere>
      <View style={[styles.header, { paddingTop: insets.top + spacing[3] }]}>
        <Pressable disabled={finishing} onPress={finish} accessibilityRole="button" style={styles.skip}>
          <Text variant="bodySmall" color="text.secondary">{t('onboarding.skip')}</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        <OnboardingVisual slide={slide} />
        <Text variant="display" style={styles.title}>{t(current.titleKey)}</Text>
        <Text color="text.secondary" style={styles.slideBody}>{t(current.bodyKey)}</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[6] }]}>
        <View style={styles.dots}>
          <ProgressDots total={slides.length} current={slide} />
        </View>
        <PrimaryBtn
          loading={finishing}
          label={isLast ? t('onboarding.start') : t('onboarding.next')}
          icon="arrowRight"
          onPress={() => (isLast ? finish() : setSlide(slide + 1))}
        />
        {isLast && <GhostBtn disabled={finishing} label={t('onboarding.guest')} onPress={finish} />}
      </View>
    </Atmosphere>
  )
}
