import { glyph } from '@/shared/ui/tokens'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Fragment, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text, View } from 'react-native'

import { toPlanSummary, usePlan, usePlanStopPlaces, useRoom, toRoomAudience } from '@/shared/api'
import { planCost } from '@/shared/pricing/plan-cost'
import { ErrorState, LoadingState, StaleNotice } from '@/shared/ui/async-state.view'
import { Atmosphere, GlassCard, PrimaryBtn } from '@/shared/ui/primitives'
import { IconCheck } from '@/shared/ui/icons'

import { styles } from './date-finished.style'

export default function DateFinishedScreen() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { planId } = useLocalSearchParams<{ planId: string }>()

  const plan = usePlan(planId)
  const summary = useMemo(() => (plan.data ? toPlanSummary(plan.data) : null), [plan.data])
  const places = usePlanStopPlaces(summary?.stops ?? [])
  const room = useRoom(summary?.roomId)

  if (plan.isPending) {
    return (
      <Atmosphere style={styles.root}>
        <LoadingState />
      </Atmosphere>
    )
  }

  // A failed refetch must not throw away a cached plan; the error screen is
  // only for having nothing at all to show (APP-007).
  if (!summary) {
    return (
      <Atmosphere style={styles.root}>
        <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />
      </Atmosphere>
    )
  }

  const roomType = room.data?.type ?? 'couple'
  // GoGo-MobileApp#249 — scoped amounts, never a total divided up.
  const cost = planCost(summary, room.data ? toRoomAudience(room.data) : null, t)

  const completed = summary.stops.filter(stop => stop.status === 'completed')

  return (
    <Atmosphere style={styles.root}>
      <View style={{ paddingTop: insets.top, alignSelf: 'stretch' }}>
        <StaleNotice error={plan.isError ? plan.error : null} onRetry={() => void plan.refetch()} />
      </View>
      <Text style={styles.burst}>✨</Text>
      <Text style={styles.title}>{t('dateFinished.title')}</Text>
      <Text style={styles.body}>{t('dateFinished.body', { context: roomType })}</Text>

      <GlassCard style={styles.card}>
        {summary.stops.map((stop, index) => (
          <Fragment key={stop.id}>
            {index > 0 && <View style={styles.connector} />}
            <View style={styles.stopRow}>
              <Text style={{ fontSize: glyph.xs }}>{stop.status === 'completed' ? '✅' : '⚪️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.stopName}>{places.byPlaceId.get(stop.placeId)?.name ?? ''}</Text>
                <Text style={styles.stopRating}>
                  {stop.arriveLabel ?? t('datePlan.stopOrder', { n: index + 1 })}
                </Text>
              </View>
              {stop.status === 'completed' ? <IconCheck /> : null}
            </View>
          </Fragment>
        ))}
        <View style={styles.footer}>
          <Text style={styles.footerMeta}>
            {Math.floor(summary.durationMinutes / 60)}h {summary.durationMinutes % 60}m ·{' '}
            {/* Scoped, and `~` while a stop's price is uncertain. */}
            {cost.primary}
            {cost.secondary ? ` · ${cost.secondary}` : ''}
          </Text>
          <Text style={styles.footerMeta}>
            {t('dateFinished.stopsDone', { done: completed.length, total: summary.stops.length })}
          </Text>
        </View>
      </GlassCard>

      <PrimaryBtn
        label={t('dateFinished.cta', { context: roomType })}
        onPress={() => router.push(`/plans/${planId}/review`)}
        style={styles.cta}
      />
    </Atmosphere>
  )
}
