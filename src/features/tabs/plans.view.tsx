import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DEMO_PLAN_ID, unsplashUrl } from '@/data/mockData'
import { usePastDates } from '@/shared/api/mock'
import { usePriceFormatter } from '@/shared/pricing'
import { Atmosphere, GlassCard, RemoteImage, TagChip } from '@/shared/ui/primitives'
import { spacing } from '@/shared/ui/tokens'
import { styles } from './plans.style'

export default function PlansScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { planTotal } = usePriceFormatter()
  const pastDates = usePastDates()

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top + spacing[2] }}>
        <Text style={styles.title}>{t('plans.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: spacing[6] }}>
        <Text style={styles.caption}>{t('plans.upcoming')}</Text>
        <Pressable onPress={() => router.push(`/plans/${DEMO_PLAN_ID}`)}>
          <GlassCard style={styles.upcomingCard}>
            <View style={styles.upcomingIcon}>
              <Text style={{ fontSize: 24 }}>🍣</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.upcomingTitle}>Japanese + Pottery</Text>
              <Text style={styles.upcomingMeta}>18:30 · {planTotal(750)}</Text>
            </View>
            <TagChip label={t('datePlan.match')} color="green" />
          </GlassCard>
        </Pressable>

        <Text style={styles.caption}>{t('plans.past')}</Text>
        {(pastDates.data ?? []).map(p => (
          <GlassCard key={p.title} style={styles.pastCard}>
            <RemoteImage uri={unsplashUrl(p.img, 160, 160)} style={styles.pastThumb} />
            <View style={{ flex: 1, padding: spacing[3] }}>
              <Text style={styles.pastTitle}>{p.title}</Text>
              <Text style={styles.pastDate}>{p.date}</Text>
              <View style={styles.pastMetaRow}>
                <Text style={styles.pastRating}>⭐ {p.rating}</Text>
                <TagChip label={p.match} color="green" />
              </View>
            </View>
          </GlassCard>
        ))}
      </ScrollView>
    </Atmosphere>
  )
}
