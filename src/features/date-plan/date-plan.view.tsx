import { useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { timeline, unsplashUrl } from '@/data/mockData'
import { track } from '@/shared/analytics'
import { usePriceFormatter } from '@/shared/pricing'
import { useRoom } from '@/shared/store/roomStore'
import { Atmosphere, BackHeader, GlassCard, RemoteImage, TagChip, Toast, glassStyles } from '@/shared/ui/primitives'
import { IconNavigation } from '@/shared/ui/icons'
import { colors, spacing } from '@/shared/ui/tokens'
import { styles } from './date-plan.style'

const { brand, neutral } = colors

const requiredK = timeline.filter(s => !s.optional).reduce((sum, s) => sum + s.priceK, 0)
const optionalK = timeline.filter(s => s.optional).reduce((sum, s) => sum + s.priceK, 0)

export default function DatePlanScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { planId } = useLocalSearchParams<{ planId: string }>()
  const { canLockStops, lockedStops, toggleLockedStop } = useRoom()
  const { stopPrice, summaryTotal, optionalExtra } = usePriceFormatter()
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function toggleLock(time: string, name: string) {
    const locking = !lockedStops.includes(time)
    toggleLockedStop(time)
    setToast(t(locking ? 'datePlan.lockedToast' : 'datePlan.unlockedToast', { name }))
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }

  const total = summaryTotal(requiredK)

  function startDate() {
    track('date_plan_accepted')
    track('date_started')
    router.push(`/plans/${planId}/active`)
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader
          onBack={() => router.back()}
          title={t('datePlan.title')}
          right={
            <View style={styles.matchBadge}>
              <Text style={styles.matchBadgeLabel}>⚡ {t('datePlan.match')}</Text>
            </View>
          }
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: 170 }}>
        {timeline.map((stop, i) => {
          const locked = lockedStops.includes(stop.time)
          return (
            <View key={stop.time} style={{ flexDirection: 'row', gap: spacing[3] }}>
              <View style={{ alignItems: 'center', width: 40 }}>
                <View style={[styles.timelineIcon, glassStyles.card]}>
                  <Text style={{ fontSize: 18 }}>{stop.emoji}</Text>
                </View>
                {i < timeline.length - 1 && <View style={styles.timelineLine} />}
              </View>

              <Pressable style={{ flex: 1 }} onPress={() => router.push('/places/sakura-omakase')}>
                <GlassCard style={[styles.stopCard, stop.optional && { opacity: 0.75 }]}>
                  <RemoteImage uri={unsplashUrl(stop.img, 600, 280)} style={styles.stopImage} />
                  <View style={{ padding: spacing[4] }}>
                    <View style={styles.stopHeader}>
                      <Text style={styles.stopTime}>{stop.time}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {stop.optional && <TagChip label={t('common.optional')} />}
                        {canLockStops && (
                          <Pressable
                            onPress={() => toggleLock(stop.time, stop.name)}
                            accessibilityRole="togglebutton"
                            accessibilityState={{ checked: locked }}
                            accessibilityLabel={t(locked ? 'datePlan.unlockHint' : 'datePlan.lockHint')}
                            style={[styles.lockBtn, locked ? { backgroundColor: brand.coralSoft } : { backgroundColor: neutral[100], opacity: 0.7 }]}
                          >
                            <Text style={{ fontSize: 12 }}>{locked ? '🔒' : '🔓'}</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                    <Text style={styles.stopName}>{stop.name}</Text>
                    <Text style={styles.stopArea}>{stop.area}</Text>
                    <View style={styles.stopPriceRow}>
                      <Text style={styles.stopPrice}>{stopPrice(stop.priceK)}</Text>
                      <Text style={styles.stopDuration}>· {stop.duration}</Text>
                    </View>
                    <View style={styles.stopTags}>
                      {stop.tags.map(tag => (
                        <TagChip key={tag} label={tag} />
                      ))}
                    </View>
                    <View style={styles.stopActions}>
                      <Pressable onPress={() => router.push('/places/sakura-omakase')} style={styles.detailBtn}>
                        <Text style={styles.detailLabel}>{t('common.details')}</Text>
                      </Pressable>
                      <Pressable style={styles.directionBtn}>
                        <IconNavigation />
                        <Text style={styles.directionLabel}>{t('common.directions')}</Text>
                      </Pressable>
                    </View>
                  </View>
                </GlassCard>
              </Pressable>
            </View>
          )
        })}
      </ScrollView>

      {/* Sticky summary + CTA */}
      <View style={[styles.summaryBar, { paddingBottom: insets.bottom + spacing[4] }]}>
        <View style={{ flexDirection: 'row', gap: spacing[4], flex: 1 }}>
          <View>
            <Text style={styles.summaryCaption}>{t('datePlan.total')}</Text>
            <Text style={styles.summaryValue}>
              {total.value} <Text style={styles.summaryUnit}>{total.unit}</Text>
            </Text>
            {total.secondary && <Text style={styles.summarySecondary}>{total.secondary}</Text>}
            <Text style={styles.summaryOptional}>{optionalExtra(optionalK)}</Text>
          </View>
          <View>
            <Text style={styles.summaryCaption}>{t('datePlan.time')}</Text>
            <Text style={styles.summaryValue}>3h 30m</Text>
          </View>
          <View>
            <Text style={styles.summaryCaption}>{t('datePlan.travel')}</Text>
            <Text style={styles.summaryValue}>{"~12'"}</Text>
          </View>
        </View>
        <Pressable onPress={startDate} style={({ pressed }) => [styles.goBtn, pressed && { opacity: 0.9 }]}>
          <Text style={styles.goLabel}>{t('datePlan.go')}</Text>
        </Pressable>
      </View>

      {toast && <Toast message={toast} />}
    </Atmosphere>
  )
}
