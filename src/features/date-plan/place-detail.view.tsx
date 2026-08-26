import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { unsplashUrl } from '@/data/mockData'
import { usePriceFormatter } from '@/shared/pricing'
import { Atmosphere, GlassCard, RemoteImage, TagChip } from '@/shared/ui/primitives'
import { IconChevronLeft, IconMapPin, IconNavigation } from '@/shared/ui/icons'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './place-detail.style'

const { neutral } = colors

const coupleRatings: [string, number][] = [
  ['💬 Trò chuyện', 4.8],
  ['❤️ Lãng mạn', 4.5],
  ['🚪 Riêng tư', 4.2],
  ['💸 Đáng tiền cho hai người', 4.6],
]

// Only attributes with real data — no generic "accessible" claims (spec §27.3)
const placeFacts: [string, string][] = [
  ['🅿️', 'Có chỗ đậu xe'],
  ['🏠', 'Trong nhà'],
  ['🤫', 'Yên tĩnh'],
  ['♿', 'Có lối vào cho xe lăn'],
]

export default function PlaceDetailScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { stopPrice } = usePriceFormatter()

  return (
    <Atmosphere>
      <View style={styles.headerImage}>
        <RemoteImage uri={unsplashUrl('photo-1562436260-126d541901e0', 700, 500)} style={StyleSheet.absoluteFill} />
        <View style={styles.imageScrim} />
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel={t('common.back')}
          style={[styles.backBtn, { top: insets.top + spacing[2] }]}
        >
          <IconChevronLeft />
        </Pressable>
      </View>

      <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[5] }}>
          <Text style={styles.name}>Sakura Omakase</Text>
          <Text style={styles.meta}>Thảo Điền · Nhà hàng Nhật · 1.2 km</Text>
          {/* Single rating line with source + sample size (spec §27.1) */}
          <Text style={styles.rating}>★ {t('placeDetail.rating')}</Text>
          <Text style={styles.price}>{stopPrice(450)}</Text>
          <Text style={styles.open}>{t('placeDetail.openNow')}</Text>

          <View style={styles.addressCard}>
            <View style={styles.addressIcon}>
              <IconMapPin />
            </View>
            <Text style={styles.addressLabel}>12 Đường 41, Thảo Điền, Thủ Đức, TP.HCM</Text>
          </View>

          <Text style={styles.sectionTitle}>{t('placeDetail.goodFor')}</Text>
          <View style={styles.tagRow}>
            {['First date', 'Quiet conversation', 'Romantic', 'Rainy day'].map(tag => (
              <TagChip key={tag} label={tag} color="violet" />
            ))}
          </View>

          <View style={styles.ratingsCard}>
            <Text style={styles.ratingsTitle}>{t('placeDetail.coupleRatings')}</Text>
            {coupleRatings.map(([label, val]) => (
              <View key={label} style={styles.ratingRow}>
                <Text style={styles.ratingLabel}>{label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={styles.ratingTrack}>
                    <View style={[styles.ratingFill, { width: `${(val / 5) * 100}%` }]} />
                  </View>
                  <Text style={styles.ratingValue}>{val}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.factsGrid}>
            {placeFacts.map(([icon, text]) => (
              <GlassCard key={text} style={styles.factCard}>
                <Text>{icon}</Text>
                <Text style={styles.factLabel}>{text}</Text>
              </GlassCard>
            ))}
          </View>

          <View style={styles.freshnessRow}>
            <Text style={styles.updated}>{t('placeDetail.updated')}</Text>
            <Pressable>
              <Text style={styles.report}>{t('placeDetail.report')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing[4] }]}>
        <Pressable accessibilityLabel={t('placeDetail.save')} style={styles.saveBtn}>
          <Text style={{ fontSize: 18 }}>🔖</Text>
        </Pressable>
        <Pressable style={styles.addBtn}>
          <Text style={styles.addLabel}>{t('placeDetail.addToPlan')}</Text>
        </Pressable>
        <Pressable style={styles.dirBtn}>
          <IconNavigation color={neutral[0]} />
          <Text style={styles.dirLabel}>{t('common.directions')}</Text>
        </Pressable>
      </View>
    </Atmosphere>
  )
}
