import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Share, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRoom } from '@/shared/store/roomStore'
import { IconShare } from '@/shared/ui/icons'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './shared-result.style'

const { brand } = colors

const commonInterests: [string, string, number][] = [
  ['🍣', 'Japanese', 88],
  ['🎨', 'Creative', 82],
  ['😌', 'Quiet', 76],
]

const funStats: [string, string, string][] = [
  ['Food compatibility', '88%', brand.coral],
  ['Activity match', '76%', brand.lavender],
  ['Budget harmony', '94%', brand.mint],
  ['Time together', '3h 18m', brand.coral],
]

export default function SharedResultScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { participantCount, roomType } = useRoom()

  async function share() {
    // Plain share via the native sheet (spec: no story/social-specific CTA).
    try {
      await Share.share({ message: `${t('sharedResult.title')} · 4.7/5 ⭐` })
    } catch {
      // user dismissed — nothing to do
    }
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing[4],
          paddingHorizontal: spacing[5],
          paddingBottom: insets.bottom + spacing[6],
        }}
      >
        <Text style={styles.title}>
          {roomType === 'group' ? `${t('matchResult.groupTitle')} · ${participantCount} 👥` : t('sharedResult.title')}
        </Text>

        <View style={styles.scoreCard}>
          <Text style={styles.score}>4.7</Text>
          <Text style={styles.scoreMax}>/ 5</Text>
          <View style={styles.scoreStars}>
            {[1, 2, 3, 4, 5].map(s => (
              <Text key={s} style={[{ fontSize: 20 }, s > 4 && { opacity: 0.4 }]}>⭐</Text>
            ))}
          </View>
        </View>

        <View style={styles.darkCard}>
          <Text style={styles.caption}>{t('sharedResult.common', { context: roomType })}</Text>
          {commonInterests.map(([icon, label, pct]) => (
            <View key={label} style={styles.interestRow}>
              <Text style={{ fontSize: 18 }}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.interestHeader}>
                  <Text style={styles.interestLabel}>{label}</Text>
                  <Text style={styles.interestPct}>{pct}%</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${pct}%` }]} />
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.darkCard}>
          <Text style={styles.caption}>{t('sharedResult.stats')}</Text>
          <View style={styles.statsGrid}>
            {funStats.map(([label, val, color]) => (
              <View key={label} style={styles.statCard}>
                <Text style={styles.statLabel}>{label}</Text>
                <Text style={[styles.statValue, { color }]}>{val}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable onPress={() => router.replace('/(tabs)')} style={styles.nextBtn}>
          <Text style={styles.nextLabel}>{t('sharedResult.nextDate')}</Text>
        </Pressable>
        <Pressable onPress={share} style={styles.shareBtn}>
          <IconShare />
          <Text style={styles.shareLabel}>{t('sharedResult.share')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  )
}
