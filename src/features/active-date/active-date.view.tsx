import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { timeline, unsplashUrl } from '@/data/mockData'
import { track } from '@/shared/analytics'
import { usePriceFormatter } from '@/shared/pricing'
import { useCheckinStore, type StopCheckin } from '@/shared/store/checkinStore'
import { Atmosphere, GlassCard, RemoteImage, TagChip } from '@/shared/ui/primitives'
import { IconArrowRight, IconMapPin, IconNavigation } from '@/shared/ui/icons'
import { spacing } from '@/shared/ui/tokens'
import { CheckinSheet } from './checkin-sheet.view'
import { styles } from './active-date.style'

export default function ActiveDateScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { planId, checkin } = useLocalSearchParams<{ planId: string; checkin?: string }>()
  const { stopPrice } = usePriceFormatter()
  const saveCheckin = useCheckinStore(s => s.saveCheckin)
  const [step, setStep] = useState(0)
  // `?checkin=1` opens the sheet immediately — demo/deep-link convenience.
  const [checkinOpen, setCheckinOpen] = useState(checkin === '1' || checkin === 'bill')

  // A live Modal overlays other screens — close it whenever we lose focus.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setTimeout(() => setCheckinOpen(false), 0)
      }
    }, []),
  )
  const stops = timeline
  const stop = stops[step]

  function completeStop() {
    track('stop_completed', { stop: stop.name, index: step + 1 })
    setCheckinOpen(true)
  }

  function advance() {
    setCheckinOpen(false)
    if (step < stops.length - 1) {
      setStep(step + 1)
    } else {
      track('date_completed', { stops: stops.length })
      router.replace(`/plans/${planId}/finished`)
    }
  }

  function handleSave(data: StopCheckin) {
    saveCheckin(stop.time, data)
    track('stop_checkin_saved', {
      stop: stop.name,
      rating: data.rating,
      photos: data.photos.length,
      tags: data.tags.join(','),
      bill: data.bill ? data.bill.totalK : 0,
    })
    advance()
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
              <Pressable onPress={completeStop} style={styles.doneBtn}>
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

      <CheckinSheet visible={checkinOpen} stop={stop} onSave={handleSave} onSkip={advance} />
    </Atmosphere>
  )
}
