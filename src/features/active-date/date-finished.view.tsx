import { useLocalSearchParams, useRouter } from 'expo-router'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'
import { timeline } from '@/data/mockData'
import { usePriceFormatter } from '@/shared/pricing'
import { useCheckinStore } from '@/shared/store/checkinStore'
import { Atmosphere, GlassCard, PrimaryBtn, RemoteImage } from '@/shared/ui/primitives'
import { IconCheck, IconStar } from '@/shared/ui/icons'
import { styles } from './date-finished.style'

const requiredK = timeline.filter(s => !s.optional).reduce((sum, s) => sum + s.priceK, 0)

export default function DateFinishedScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { planId } = useLocalSearchParams<{ planId: string }>()
  const { summaryTotal } = usePriceFormatter()
  const checkins = useCheckinStore(state => state.checkins)
  const total = summaryTotal(requiredK)

  return (
    <Atmosphere style={styles.root}>
      <Text style={styles.burst}>✨</Text>
      <Text style={styles.title}>{t('dateFinished.title')}</Text>
      <Text style={styles.body}>{t('dateFinished.body')}</Text>

      <GlassCard style={styles.card}>
        {timeline.map((stop, i) => (
          <Fragment key={stop.name}>
            {i > 0 && <View style={styles.connector} />}
            <View style={styles.stopRow}>
              <Text style={{ fontSize: 20 }}>{stop.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.stopName}>{stop.name}</Text>
                {checkins[stop.time] && checkins[stop.time].rating > 0 && (
                  <Text style={styles.stopRating}>{'⭐'.repeat(checkins[stop.time].rating)}</Text>
                )}
              </View>
              {checkins[stop.time] && checkins[stop.time].photos.length > 0 ? (
                <View style={styles.photoStrip}>
                  {checkins[stop.time].photos.slice(0, 2).map(uri => (
                    <RemoteImage key={uri} uri={uri} style={styles.photoThumb} />
                  ))}
                </View>
              ) : (
                <IconCheck />
              )}
            </View>
          </Fragment>
        ))}
        <View style={styles.footer}>
          <Text style={styles.footerMeta}>3h 18m · {total.value} {total.unit}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map(s => (
              <IconStar key={s} />
            ))}
          </View>
        </View>
      </GlassCard>

      <PrimaryBtn label={t('dateFinished.cta')} onPress={() => router.push(`/plans/${planId}/review`)} style={styles.cta} />
    </Atmosphere>
  )
}
