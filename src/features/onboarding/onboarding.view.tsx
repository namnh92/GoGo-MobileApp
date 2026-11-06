import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { MessageKey } from '@/shared/i18n/types'
import { pushPermission } from '@/shared/notifications/permission-bootstrap'
import { onboardingPermissionStore } from '@/shared/notifications/onboarding-permission-store'
import { markOnboardingComplete } from '@/shared/storage/onboarding'
import { Atmosphere, GhostBtn, IconBtn, PrimaryBtn, ProgressDots } from '@/shared/ui/primitives'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { Text } from '@/shared/ui/text'
import { OnboardingVisual } from './onboarding-visual.view'
import { styles } from './onboarding.style'

const slides = [
  { titleKey: 'onboarding.slide1.title', bodyKey: 'onboarding.slide1.body', dots: 'debate' },
  { titleKey: 'onboarding.slide2.title', bodyKey: 'onboarding.slide2.body', dots: 'swipe' },
  { titleKey: 'onboarding.slide3.title', bodyKey: 'onboarding.slide3.body', dots: 'plan' },
] as const satisfies readonly { titleKey: MessageKey; bodyKey: MessageKey; dots: 'debate' | 'swipe' | 'plan' }[]

export default function OnboardingScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [slide, setSlide] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const current = slides[slide]
  const isLast = slide === 2

  async function finish() {
    if (finishing) return
    setFinishing(true)
    await markOnboardingComplete()
    await pushPermission.request().catch(() => undefined)
    router.replace('/(tabs)')
  }

  async function start() {
    if (finishing) return
    setFinishing(true)
    await onboardingPermissionStore.defer()
    await markOnboardingComplete()
    router.replace('/auth/sign-in')
  }

  return (
    <Atmosphere redesign>
      <ScrollView contentContainerStyle={[styles.content, isLast && styles.lastContent, { paddingTop: insets.top, paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.header, slide > 0 && styles.headerSpaced]}>
          {isLast && <IconBtn accessibilityLabel={t('common.back')} disabled={finishing} onPress={() => setSlide(1)} style={styles.back}>
            <MaterialIcon name="arrowBack" size={24} />
          </IconBtn>}
          <View style={styles.headerSpace} />
          <GhostBtn variant={slide === 1 ? 'stitchSkipPill' : 'stitchSkip'} disabled={finishing} label={t('onboarding.skip')} onPress={finish} />
        </View>
        <View style={[styles.visual, isLast && styles.lastVisual]}>
          <OnboardingVisual slide={slide} />
        </View>
        {isLast && <View style={styles.lastDots}><ProgressDots total={3} current={slide} variant={current.dots} /></View>}
        <View style={[styles.narrative, slide === 1 && styles.swipeNarrative]}>
          <Text variant={slide === 1 ? 'introCompact' : 'introTitle'} color={slide === 1 ? 'redesign.mutedTitle' : 'redesign.ink'} style={styles.title}>{t(current.titleKey)}</Text>
          <Text variant={slide > 0 ? 'introRelaxed' : 'introBody'} color={slide === 1 ? 'redesign.mutedBody' : 'redesign.secondary'} style={styles.body}>{t(current.bodyKey)}</Text>
        </View>
        {!isLast && <View style={[styles.dots, slide === 1 && styles.swipeDots]}><ProgressDots total={3} current={slide} variant={current.dots} /></View>}
        <View style={[styles.actions, isLast && styles.lastActions]}>
          <PrimaryBtn variant={slide === 1 ? 'stitchSubtle' : 'stitch'} loading={finishing} label={t(isLast ? 'onboarding.start' : 'onboarding.next')} icon={isLast ? undefined : 'arrowRight'} onPress={() => { if (isLast) void start(); else setSlide(slide + 1) }} />
          {isLast && <GhostBtn variant="stitchGuest" disabled={finishing} label={t('onboarding.guest')} onPress={finish} />}
        </View>
      </ScrollView>
    </Atmosphere>
  )
}
