import { glyph } from '@/shared/ui/tokens'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Fragment, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text, View } from 'react-native'

import { toPlanSummary, usePlan, usePlanStopPlaces, useRoom, useFinishDate, toRoomAudience } from '@/shared/api'
import { costLineText, planCost } from '@/shared/pricing/plan-cost'
import { ErrorState, LoadingState, StaleNotice } from '@/shared/ui/async-state.view'
import { Atmosphere, GlassCard, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
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

  /**
   * #269 — SRS §7.2 `active --> completed: finish`. The app used to end only its
   * own screen: every stop completed, this summary shown, and the room left
   * `active` for good, so the Plans history tab (#213) never listed a date
   * anyone had been on.
   *
   * It belongs here rather than on the screen that completed the last stop.
   * That screen only sees the ending it caused, and there are three other ways
   * to arrive: a member completes the last stop, the app is relaunched between
   * completing it and closing its sheet, or the host taps through from a date
   * whose stops are all done. Whoever reaches this screen closes the room.
   *
   * Host-only on the server, so only the host sends it; for everyone else this
   * is a read-only summary.
   */
  const finishDate = useFinishDate(summary?.roomId, planId)
  const stops = summary?.stops ?? []
  const nothingLeft = stops.length > 0 && stops.every(stop => stop.status !== 'planned')
  const needsClosing = room.data?.myRole === 'host' && room.data.status === 'active' && nothingLeft

  // One automatic attempt. A failure is not swallowed: it becomes the state
  // below, with a retry, rather than a summary that claims a date is over while
  // the room says otherwise.
  const attempted = useRef(false)
  const { finish } = finishDate
  useEffect(() => {
    if (!needsClosing || attempted.current) return
    attempted.current = true
    void finish().catch(() => undefined)
  }, [needsClosing, finish])

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
            {costLineText(cost.primary)}
            {cost.secondary ? ` · ${costLineText(cost.secondary)}` : ''}
          </Text>
          <Text style={styles.footerMeta}>
            {t('dateFinished.stopsDone', { done: completed.length, total: summary.stops.length })}
          </Text>
        </View>
      </GlassCard>

      {needsClosing ? (
        <View style={styles.closing}>
          {/* Only a refusal reads as a failure. Anything else — in flight, or
              the room not yet refetched — is still the room being closed. */}
          {finishDate.isError ? (
            <>
              <Text accessibilityLiveRegion="polite" style={styles.closingFailed}>
                {t('dateFinished.closeFailed')}
              </Text>
              <SecondaryBtn
                label={t('dateFinished.closeRetry')}
                onPress={() => void finish().catch(() => undefined)}
              />
            </>
          ) : (
            <Text accessibilityLiveRegion="polite" style={styles.closingNote}>
              {t('dateFinished.closing')}
            </Text>
          )}
        </View>
      ) : null}

      <PrimaryBtn
        label={t('dateFinished.cta', { context: roomType })}
        onPress={() => router.push(`/plans/${planId}/review`)}
        style={styles.cta}
      />
    </Atmosphere>
  )
}
