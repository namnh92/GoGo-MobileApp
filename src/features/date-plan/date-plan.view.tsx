import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  roomCapabilities,
  toPlanSummary,
  useLockPlanStop,
  usePlan,
  useRegeneratePlan,
  usePlanStopPlaces,
  useRoom,
  useRoomRealtime,
  type PlanStopRow,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { openGoogleMapsDirections } from '@/shared/navigation/directions'
import { formatMoney, formatRange, perPerson } from '@/shared/pricing/money'
import { ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Atmosphere, PrimaryBtn, BackHeader, GlassCard, TagChip, Toast, glassStyles } from '@/shared/ui/primitives'
import { IconNavigation } from '@/shared/ui/icons'
import { colors, hitSlop, spacing } from '@/shared/ui/tokens'

import { styles } from './date-plan.style'

const { brand, neutral } = colors

export default function DatePlanScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { planId } = useLocalSearchParams<{ planId: string }>()

  const plan = usePlan(planId)
  const summary = useMemo(() => (plan.data ? toPlanSummary(plan.data) : null), [plan.data])
  const places = usePlanStopPlaces(summary?.stops ?? [])
  const room = useRoom(summary?.roomId)
  // Another member can regenerate or lock while this screen is open.
  useRoomRealtime(summary?.roomId, 'plan')
  const lockStop = useLockPlanStop(planId)
  const regenerate = useRegeneratePlan(planId)

  const capabilities = roomCapabilities(room.data)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function toggleLock(stop: PlanStopRow, name: string) {
    const locking = !stop.isLocked
    // Optimistic in the hook; the returned plan replaces the guess because a
    // lock can shift the times and totals of every later stop.
    lockStop.mutate({ stopId: stop.id, locked: locking })
    setToast(t(locking ? 'datePlan.lockedToast' : 'datePlan.unlockedToast', { name }))
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }

  /**
   * Host-only rebuild. Locked stops come back verbatim (RULE-CORE-007), so the
   * toast reports how many survived — that guarantee is the whole point of the
   * padlock, and it was previously unreachable from the app.
   */
  async function rebuild() {
    const lockedBefore = summary?.stops.filter(stop => stop.isLocked).length ?? 0
    try {
      const next = await regenerate.mutateAsync({})
      const kept = (next.stops ?? []).filter(stop => stop.isLocked).length
      setToast(
        lockedBefore > 0
          ? t('datePlan.regeneratedKept', { n: kept })
          : t('datePlan.regenerated'),
      )
      // A rebuild supersedes this plan and returns a new one.
      if (next.id && next.id !== planId) router.replace(`/plans/${next.id}`)
    } catch {
      setToast(t('datePlan.regenerateFailed'))
    }
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  function startDate() {
    track('date_plan_accepted')
    track('date_started')
    router.push(`/plans/${planId}/active`)
  }

  const header = (
    <View style={{ paddingTop: insets.top }}>
      <BackHeader onBack={() => router.back()} title={t('datePlan.title')} />
    </View>
  )

  if (plan.isPending) {
    return (
      <Atmosphere>
        {header}
        <LoadingState />
      </Atmosphere>
    )
  }

  if (plan.isError || !summary) {
    return (
      <Atmosphere>
        {header}
        <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />
      </Atmosphere>
    )
  }

  const participantCount = room.data?.participantCount ?? 2
  const roomType = room.data?.type ?? 'couple'
  const budgetMode = room.data?.constraints?.budgetMode ?? 'total'

  /** Group rooms always carry both scopes; the per-person figure is approximate. */
  const totalLabel = formatMoney(summary.costMax, summary.currency)
  const perPersonLabel =
    roomType === 'group'
      ? formatMoney(perPerson(summary.costMax, participantCount, summary.currency), summary.currency)
      : null

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
        {/* A plan built before the last constraint edit is no longer the answer. */}
        {summary.isStale ? <Text style={styles.staleWarning}>⚠️ {t('datePlan.stale')}</Text> : null}

        {/* Someone edited or rebuilt this plan — possibly on another device. */}
        {summary.status === 'superseded' ? (
          <Pressable
            onPress={() => router.replace(`/room/${summary.roomId}`)}
            accessibilityRole="button"
          >
            <Text style={styles.staleWarning}>⚠️ {t('datePlan.superseded')}</Text>
          </Pressable>
        ) : null}

        {summary.stops.map((stop, index) => {
          const place = places.byPlaceId.get(stop.placeId)
          const name = place?.name ?? ''
          const stopCost = formatRange(stop.costMin, stop.costMax, summary.currency)

          return (
            <View key={stop.id}>
              {stop.travelMinutesFromPrev != null && index > 0 && (
                <View style={styles.legRow}>
                  <View style={styles.legLineCol}>
                    <View style={styles.legLine} />
                  </View>
                  <Text style={styles.legLabel}>
                    {t('datePlan.travelLeg', { n: stop.travelMinutesFromPrev })}
                  </Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                <View style={{ alignItems: 'center', width: 40 }}>
                  <View style={[styles.timelineIcon, glassStyles.card]}>
                    <Text style={{ fontSize: 18 }}>{stop.status === 'completed' ? '✅' : '📍'}</Text>
                  </View>
                  {index < summary.stops.length - 1 && <View style={styles.timelineLine} />}
                </View>

                <Pressable
                  accessibilityRole="button"
                  style={{ flex: 1 }}
                  onPress={() => router.push(`/places/${stop.placeId}`)}
                >
                  <GlassCard style={styles.stopCard}>
                    <PlacePhoto placeId={stop.placeId} name={name} uri={null} style={styles.stopImage} />
                    <View style={{ padding: spacing[4] }}>
                      <View style={styles.stopHeader}>
                        {/* A room with no `startAt` gets no scheduled times, so
                            the order is shown rather than an empty clock. */}
                        <Text style={styles.stopTime}>
                          {stop.arriveLabel ?? t('datePlan.stopOrder', { n: index + 1 })}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {stop.status === 'completed' ? <TagChip label={t('datePlan.done')} /> : null}
                          {/* Host-only, and server-enforced. */}
                          {capabilities.canLockStops && (
                            <Pressable
                              onPress={() => toggleLock(stop, name)}
                              accessibilityRole="togglebutton"
                              accessibilityState={{ checked: stop.isLocked }}
                              accessibilityLabel={t(stop.isLocked ? 'datePlan.unlockHint' : 'datePlan.lockHint')}
                              hitSlop={hitSlop}
                              style={[
                                styles.lockBtn,
                                stop.isLocked
                                  ? { backgroundColor: brand.coralSoft }
                                  : { backgroundColor: neutral[100], opacity: 0.7 },
                              ]}
                            >
                              <Text style={{ fontSize: 12 }}>{stop.isLocked ? '🔒' : '🔓'}</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                      <Text style={styles.stopName}>{name}</Text>
                      {place?.addressText ? <Text style={styles.stopArea}>{place.addressText}</Text> : null}
                      <View style={styles.stopPriceRow}>
                        {stopCost ? <Text style={styles.stopPrice}>{stopCost}</Text> : null}
                        <Text style={styles.stopDuration}>
                          · {t('datePlan.minutes', { n: stop.durationMinutes })}
                        </Text>
                      </View>
                      <View style={styles.stopActions}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => router.push(`/places/${stop.placeId}`)}
                          hitSlop={hitSlop}
                          style={styles.detailBtn}
                        >
                          <Text style={styles.detailLabel}>{t('common.details')}</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => openGoogleMapsDirections(place?.addressText ?? name)}
                          hitSlop={hitSlop}
                          style={styles.directionBtn}
                        >
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

      <View style={[styles.summaryBar, { paddingBottom: insets.bottom + spacing[3] }]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryColMain}>
            <Text style={styles.summaryCaption}>{t('datePlan.total')}</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {/* `uncertain` means a stop has an unknown price — say so rather
                  than presenting an estimate as the total. */}
              {summary.uncertain ? `~${totalLabel}` : totalLabel}{' '}
              <Text style={styles.summaryUnit}>
                {budgetMode === 'per_person' && perPersonLabel ? t('price.groupTotal') : t('datePlan.for2')}
              </Text>
            </Text>
            {perPersonLabel ? (
              <Text style={styles.summarySecondary} numberOfLines={1}>
                ~{perPersonLabel}
                {t('datePlan.perPerson')}
              </Text>
            ) : null}
            {/* Computed from the upper bound — never soften it. */}
            {summary.overBudget ? (
              <Text style={styles.summaryOverBudget} numberOfLines={1}>
                {t('datePlan.overBudget')}
              </Text>
            ) : null}
          </View>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryCaption}>{t('datePlan.time')}</Text>
            <Text style={styles.summaryValue}>
              {Math.floor(summary.durationMinutes / 60)}h {summary.durationMinutes % 60}m
            </Text>
          </View>
        </View>
        <PrimaryBtn label={t('datePlan.go')} onPress={startDate} style={styles.goBtn} />
        {capabilities.isHost ? (
          <Pressable
            onPress={() => router.push(`/plans/${planId}/edit`)}
            accessibilityRole="button"
            style={styles.regenerateBtn}
          >
            <Text style={styles.regenerateLabel}>{t('datePlan.edit')}</Text>
          </Pressable>
        ) : null}
        {capabilities.canRegenerate ? (
          <Pressable
            onPress={rebuild}
            disabled={regenerate.isPending}
            accessibilityRole="button"
            accessibilityState={{ disabled: regenerate.isPending, busy: regenerate.isPending }}
            style={styles.regenerateBtn}
          >
            <Text style={styles.regenerateLabel}>
              {regenerate.isPending ? t('datePlan.regenerating') : t('datePlan.regenerate')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {toast && <Toast message={toast} />}
    </Atmosphere>
  )
}
