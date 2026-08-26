import { useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { timeline, unsplashUrl } from '@/data/mockData'
import { track } from '@/shared/analytics'
import { openGoogleMapsDirections } from '@/shared/navigation/directions'
import { usePriceFormatter } from '@/shared/pricing'
import { useRoom } from '@/shared/store/roomStore'
import { Atmosphere, PrimaryBtn, BackHeader, GlassCard, RemoteImage, TagChip, Toast, glassStyles } from '@/shared/ui/primitives'
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

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: 240 }}>
        {timeline.map((stop, i) => {
          const locked = lockedStops.includes(stop.time)
          return (
            <View key={stop.time}>
            {stop.travelMinFromPrev != null && i > 0 && (
              <View style={styles.legRow}>
                <View style={styles.legLineCol}>
                  <View style={styles.legLine} />
                </View>
                <Text style={styles.legLabel}>{t('datePlan.travelLeg', { n: stop.travelMinFromPrev })}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: spacing[3] }}>
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
                      <Pressable onPress={() => openGoogleMapsDirections(`${stop.name}, ${stop.area}`)} style={styles.directionBtn}>
                        <IconNavigation />
                        <Text style={styles.directionLabel}>{t('common.directions')}</Text>
                      </Pressable>
                    </View>
                  </View>
                </GlassCard>
              </Pressable>
            </View>
            </View>
          )
        })}
      </ScrollView>

      {/* Sticky summary + CTA — stats row on top, full-width CTA below */}
      <View style={[styles.summaryBar, { paddingBottom: insets.bottom + spacing[3] }]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryColMain}>
            <Text style={styles.summaryCaption}>{t('datePlan.total')}</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {total.value} <Text style={styles.summaryUnit}>{total.unit}</Text>
            </Text>
            {total.secondary && <Text style={styles.summarySecondary} numberOfLines={1}>{total.secondary}</Text>}
            <Text style={styles.summaryOptional} numberOfLines={1}>{optionalExtra(optionalK)}</Text>
          </View>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryCaption}>{t('datePlan.time')}</Text>
            <Text style={styles.summaryValue}>3h 30m</Text>
          </View>
        </View>
        <PrimaryBtn label={t('datePlan.go')} onPress={startDate} style={styles.goBtn} />
      </View>

      {toast && <Toast message={toast} />}
    </Atmosphere>
  )
}
