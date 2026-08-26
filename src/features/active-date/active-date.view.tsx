import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { timeline, unsplashUrl } from '@/data/mockData'
import { track } from '@/shared/analytics'
import { usePriceFormatter } from '@/shared/pricing'
import { Atmosphere, GlassCard, RemoteImage, TagChip } from '@/shared/ui/primitives'
import { IconArrowRight, IconMapPin, IconNavigation } from '@/shared/ui/icons'
import { spacing } from '@/shared/ui/tokens'
import { styles } from './active-date.style'

export default function ActiveDateScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { planId } = useLocalSearchParams<{ planId: string }>()
  const { stopPrice } = usePriceFormatter()
  const [step, setStep] = useState(0)
  const stops = timeline
  const stop = stops[step]

  function nextStep() {
    if (step < stops.length - 1) {
      setStep(step + 1)
    } else {
      track('date_completed', { stops: stops.length })
      router.push(`/plans/${planId}/finished`)
    }
  }

  return (
    <Atmosphere>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing[3] }]}>
        <View>
          <Text style={styles.live}>{t('activeDate.live')}</Text>
          <Text style={styles.stopCounter}>{t('activeDate.stop', { n: step + 1, total: stops.length })}</Text>
        </View>
        <View style={styles.stepDots}>
          {stops.map((s, i) => (
            <View key={s.time} style={[styles.stepDot, i === step && styles.stepDotActive, i < step && styles.stepDotDone]} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: spacing[6] }}>
        <GlassCard style={styles.card}>
          <RemoteImage uri={unsplashUrl(stop.img, 700, 300)} style={styles.cardImage} />
          <View style={styles.cardBody}>
            <View style={styles.cardHeader}>
              <Text style={{ fontSize: 24 }}>{stop.emoji}</Text>
              <TagChip label={t('activeDate.ongoing')} color="green" />
            </View>
            <Text style={styles.name}>{stop.name}</Text>
            <Text style={styles.area}>{stop.area}</Text>

            <View style={styles.mapThumb}>
              <IconMapPin />
              <Text style={styles.mapLabel}>{t('activeDate.viewMap')}</Text>
            </View>

            <View style={styles.actions}>
              <Pressable style={styles.dirBtn}>
                <IconNavigation />
                <Text style={styles.dirLabel}>{t('common.directions')}</Text>
              </Pressable>
              <Pressable onPress={nextStep} style={styles.doneBtn}>
                <Text style={styles.doneLabel}>
                  {step < stops.length - 1 ? t('activeDate.doneStep') : t('activeDate.finish')}
                </Text>
              </Pressable>
            </View>
          </View>
        </GlassCard>

        {step < stops.length - 1 && (
          <GlassCard style={styles.nextCard}>
            <Text style={{ fontSize: 24 }}>{stops[step + 1].emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextCaption}>{t('activeDate.next')}</Text>
              <Text style={styles.nextName}>{stops[step + 1].name}</Text>
              <Text style={styles.nextMeta}>{stops[step + 1].time} · {stopPrice(stops[step + 1].priceK)}</Text>
            </View>
            <IconArrowRight />
          </GlassCard>
        )}
      </ScrollView>
    </Atmosphere>
  )
}
