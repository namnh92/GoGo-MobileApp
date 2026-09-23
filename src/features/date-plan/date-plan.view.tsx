import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  formatDistance,
  isApiError,
  isForbidden,
  isOffline,
  roomCapabilities,
  toPlanSummary,
  useLockPlanStop,
  usePlan,
  useRegeneratePlan,
  usePlanStopPlaces,
  useRoom,
  useRoomRealtime,
  useStartDate,
  type PlanStopRow,
  toRoomAudience,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { openGoogleMapsDirections } from '@/shared/navigation/directions'
import { costLineText, planCost, stopCostLabel } from '@/shared/pricing/plan-cost'
import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { useScreenFocused } from '@/shared/hooks/use-screen-focused'
import { ErrorState, OfflineState, StaleNotice } from '@/shared/ui/async-state.view'
import { haptic } from '@/shared/ui/feedback'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import {
  Atmosphere,
  BackHeader,
  Chip,
  GhostBtn,
  GlassCard,
  PrimaryBtn,
  SecondaryBtn,
  Toast,
  glassStyles,
} from '@/shared/ui/primitives'
import { PlanSkeleton } from '@/shared/ui/skeleton.view'
import { IconNavigation } from '@/shared/ui/icons'
import { colors, glyph, hitSlop, spacing } from '@/shared/ui/tokens'

import { planStep, useRoomStepShown } from '@/shared/navigation/room-steps'

import { styles } from './date-plan.style'
import { planStart, planWhen } from './plan-title'

const { brand, neutral } = colors

export default function DatePlanScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { planId } = useLocalSearchParams<{ planId: string }>()

  const plan = usePlan(planId)
  const waitingForNetwork = useWaitingForNetwork(plan)
  const summary = useMemo(() => (plan.data ? toPlanSummary(plan.data) : null), [plan.data])
  const places = usePlanStopPlaces(summary?.stops ?? [])
  const room = useRoom(summary?.roomId)
  // Another member can regenerate or lock while this screen is open.
  // A stream costs a socket, and the server caps how many one actor may hold.
  // Expo Router keeps pushed screens mounted, so a stack of plans would have
  // held one each; only the screen on top needs to be live.
  useRoomRealtime(summary?.roomId, 'plan', { enabled: useScreenFocused() })
  // The lobby opens a room's plan once (#198). Its "go to the room" below must
  // not bounce straight back here — only to a newer plan, when this one is superseded.
  useRoomStepShown(summary?.roomId, summary?.id ? planStep(summary.id) : null)
  const lockStop = useLockPlanStop(planId)
  const regenerate = useRegeneratePlan(planId)
  const startDate = useStartDate(summary?.roomId, planId)

  const capabilities = roomCapabilities(room.data)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The start answered with a room that neither started nor ended; the reason
  // stays under the button until the next press.
  const [notStarted, setNotStarted] = useState(false)

  // #251 — a start that answers after the user left this screen, or opened
  // another one on top of it, must not pull them into the active date.
  const focused = useRef(false)
  useFocusEffect(
    useCallback(() => {
      focused.current = true
      return () => {
        focused.current = false
      }
    }, []),
  )

  function toggleLock(stop: PlanStopRow, name: string) {
    const locking = !stop.isLocked
    // A lock is a commitment the user cannot see land immediately — the times
    // below it shift a moment later — so it earns a tick.
    haptic(locking ? 'success' : 'select')
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

  /**
   * #251 — the host's "Bắt đầu đi" moves the room `ready → active` before the
   * active date opens; until then the server refuses every stop completion and
   * check-in. A tap that joins one already in flight resolves `null` and does
   * nothing, so a double tap is one request and one navigation.
   */
  async function onStart() {
    setNotStarted(false)
    let started
    try {
      started = await startDate.start({ onSend: () => track('date_plan_accepted') })
    } catch {
      // The error renders under the button, which becomes the retry.
      return
    }
    if (!started) return
    // Act on the status the server answered with, never on "it succeeded": a
    // repeated start that races the end of the date answers with a finished or
    // cancelled room (GoGo-BE #601), and that room must not open a live screen.
    if (started.status === 'active') {
      track('date_started')
      if (focused.current) router.push(`/plans/${planId}/active`)
    } else if (started.status === 'completed') {
      if (focused.current) router.push(`/plans/${planId}/finished`)
    } else if (started.status !== 'cancelled' && started.status !== 'expired') {
      setNotStarted(true)
    }
    // Cancelled or expired: the start wrote that room to the cache, and the bar
    // below renders its copy in place of the button.
  }

  function openActiveDate() {
    router.push(`/plans/${planId}/active`)
  }

  /**
   * #254, RULE-CORE-003 — who the room is for and when the plan starts, never
   * a fixed "Date tối nay". Until the room is known the title stays neutral
   * rather than assuming a couple.
   */
  function screenTitle(): string {
    const facts = room.data
    if (!facts) return t('datePlan.title')
    const start = planStart(plan.data?.stops, facts)
    if (!start) return t('datePlan.titleUndated', { context: facts.type, n: facts.participantCount })
    const { relative, ...parts } = planWhen(start, new Date())
    const when = t(
      relative === 'today'
        ? 'datePlan.when.today'
        : relative === 'tomorrow'
          ? 'datePlan.when.tomorrow'
          : relative === 'otherYear'
            ? 'datePlan.when.otherYear'
            : 'datePlan.when.other',
      parts,
    )
    return t('datePlan.title', { context: facts.type, n: facts.participantCount, when })
  }

  const header = (
    <View style={{ paddingTop: insets.top }}>
      <BackHeader onBack={() => router.back()} title={screenTitle()} />
    </View>
  )

  if (plan.isPending) {
    return (
      <Atmosphere>
        {header}
        {/* Nothing cached and offline: the paused read would keep the skeleton forever (#253). */}
        {waitingForNetwork ? (
          <OfflineState />
        ) : (
          <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[4] }}>
            <PlanSkeleton count={3} />
          </View>
        )}
      </Atmosphere>
    )
  }

  // A failed refetch must not throw away a cached plan; the error screen is
  // only for having nothing at all to show (APP-007).
  if (!summary) {
    return (
      <Atmosphere>
        {header}
        <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />
      </Atmosphere>
    )
  }


  /**
   * What the bottom bar offers depends on the room's status and the caller's
   * role, both from the server: only the host can start (the API answers
   * `403 HOST_ONLY` to anyone else), and everyone can open a date in progress.
   * Members learn that it started through `useRoomRealtime` above.
   */
  const roomStatus = room.data?.status

  function renderDateAction() {
    if (!room.data) {
      return room.isError ? (
        <View style={styles.startNotice} accessibilityLiveRegion="polite">
          <Text style={styles.startNoticeLabel}>{t('datePlan.roomUnavailable')}</Text>
          <GhostBtn label={t('common.retry')} onPress={() => void room.refetch()} />
        </View>
      ) : (
        <PrimaryBtn label={t('datePlan.go')} onPress={onStart} disabled loading style={styles.goBtn} />
      )
    }
    if (roomStatus === 'active') {
      return <PrimaryBtn label={t('datePlan.enter')} onPress={openActiveDate} style={styles.goBtn} />
    }
    // A finished date is a summary to look back on, not a live screen.
    if (roomStatus === 'completed') {
      return (
        <PrimaryBtn
          label={t('datePlan.viewSummary')}
          onPress={() => router.push(`/plans/${planId}/finished`)}
          style={styles.goBtn}
        />
      )
    }
    if (roomStatus === 'ready' && capabilities.isHost) {
      return (
        <>
          <PrimaryBtn
            label={
              startDate.isPending
                ? t('datePlan.starting')
                : startDate.isError || notStarted
                  ? t('common.retry')
                  : t('datePlan.go')
            }
            onPress={onStart}
            loading={startDate.isPending}
            style={styles.goBtn}
          />
          {startDate.isError || notStarted ? (
            <Text accessibilityLiveRegion="polite" style={styles.startError}>
              {t(
                notStarted
                  ? 'datePlan.notStartable'
                  : isOffline(startDate.error)
                    ? 'datePlan.startOffline'
                    : isApiError(startDate.error) && startDate.error.code === 'HOST_ONLY'
                      ? 'datePlan.startHostOnly'
                      : isForbidden(startDate.error)
                        ? 'common.permissionDenied'
                        : 'datePlan.startFailed',
              )}
            </Text>
          ) : null}
        </>
      )
    }
    return (
      <View style={styles.startNotice} accessibilityLiveRegion="polite">
        <Text style={styles.startNoticeLabel}>
          {t(
            roomStatus === 'ready'
              ? 'datePlan.waitingHost'
              : roomStatus === 'cancelled'
                ? 'datePlan.roomCancelled'
                : roomStatus === 'expired'
                  ? 'datePlan.roomExpired'
                  : 'datePlan.notStartable',
          )}
        </Text>
      </View>
    )
  }

  // GoGo-MobileApp#249 — the amounts carry their scope; the room only decides
  // how the other scope is phrased. Until the room loads, only the scope the API
  // stated is shown, never an assumed couple.
  const cost = planCost(summary, room.data ? toRoomAudience(room.data) : null, t)

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader
          onBack={() => router.back()}
          title={screenTitle()}
          right={
            <View style={styles.matchBadge}>
              <Text style={styles.matchBadgeLabel}>⚡ {t('datePlan.match')}</Text>
            </View>
          }
        />
      </View>
      <StaleNotice error={plan.isError ? plan.error : null} onRetry={() => void plan.refetch()} />

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
          const stopCost = stopCostLabel(stop, summary.currency, t)

          return (
            <View key={stop.id}>
              {stop.travelMinutesFromPrev != null && index > 0 && (
                <View style={styles.legRow}>
                  <View style={styles.legLineCol}>
                    <View style={styles.legLine} />
                  </View>
                  {/* Minutes and distance both come from the optimizer. The
                      contract carries no travel *mode*, so none is claimed. */}
                  <View style={styles.legRail}>
                    <Text style={styles.legLabel}>
                      {t('datePlan.travelLeg', { n: stop.travelMinutesFromPrev })}
                    </Text>
                    {stop.travelDistanceMFromPrev != null ? (
                      <Text style={styles.legDistance}>
                        · {formatDistance(stop.travelDistanceMFromPrev)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: spacing[3] }}>
                <View style={{ alignItems: 'center', width: 40 }}>
                  <View
                    style={[
                      styles.timelineDot,
                      glassStyles.card,
                      stop.isLocked && styles.timelineDotLocked,
                    ]}
                  >
                    <Text style={{ fontSize: glyph.xs }}>
                      {stop.status === 'completed' ? '✅' : stop.isLocked ? '🔒' : '📍'}
                    </Text>
                  </View>
                  {index < summary.stops.length - 1 && <View style={styles.timelineLine} />}
                </View>

                <Pressable
                  accessibilityRole="button"
                  style={{ flex: 1 }}
                  onPress={() => router.push(`/places/${stop.placeId}`)}
                >
                  <GlassCard
                    style={[
                      styles.stopCard,
                      stop.isLocked && styles.stopCardLocked,
                      stop.status === 'completed' && styles.stopCardCompleted,
                    ]}
                  >
                    <PlacePhoto placeId={stop.placeId} name={name} uri={null} style={styles.stopImage} />
                    <View style={{ padding: spacing[4] }}>
                      <View style={styles.stopHeader}>
                        {/* A room with no `startAt` gets no scheduled times, so
                            the order is shown rather than an empty clock. */}
                        <Text style={styles.stopTime}>
                          {stop.arriveLabel ?? t('datePlan.stopOrder', { n: index + 1 })}
                        </Text>
                        <View style={styles.stopBadges}>
                          {stop.status === 'completed' ? (
                            <Chip label={t('datePlan.done')} variant="positive" />
                          ) : null}
                          {/* Locked reads as locked without colour: padlock,
                              word, and the card's left edge all say it. */}
                          {stop.isLocked && !capabilities.canLockStops ? (
                            <Chip label={t('datePlan.locked')} icon="🔒" variant="warning" />
                          ) : null}
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
                                  : { backgroundColor: neutral[100] },
                              ]}
                            >
                              <Text style={{ fontSize: glyph.xs }}>{stop.isLocked ? '🔒' : '🔓'}</Text>
                              <Text
                                style={[
                                  styles.lockBtnLabel,
                                  { color: stop.isLocked ? brand.coral : neutral[500] },
                                ]}
                              >
                                {t(stop.isLocked ? 'datePlan.locked' : 'datePlan.lockable')}
                              </Text>
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
                          style={styles.detailBtn}
                        >
                          <Text style={styles.detailLabel}>{t('common.details')}</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            haptic('select')
                            openGoogleMapsDirections(place?.addressText ?? name)
                          }}
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
            {/* One formatter owns the amount and its scope (GoGo-MobileApp#249).
                They are separate texts so the scope wraps under the amount
                instead of being truncated off a narrow screen. */}
            <View style={styles.summaryAmountRow}>
              {cost.primary.amount ? <Text style={styles.summaryValue}>{cost.primary.amount}</Text> : null}
              <Text style={cost.primary.amount ? styles.summaryUnit : styles.summaryValue}>{cost.primary.unit}</Text>
            </View>
            {cost.secondary ? (
              <Text style={styles.summarySecondary}>{costLineText(cost.secondary)}</Text>
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
        {renderDateAction()}
        {/* Starting or opening the date is the one dominant CTA; edit and rebuild sit below it. */}
        <View style={styles.secondaryRow}>
          {capabilities.isHost ? (
            <GhostBtn label={t('datePlan.edit')} onPress={() => router.push(`/plans/${planId}/edit`)} style={{ flex: 1 }} />
          ) : null}
          {capabilities.canRegenerate ? (
            <SecondaryBtn
              label={regenerate.isPending ? t('datePlan.regenerating') : t('datePlan.regenerate')}
              onPress={rebuild}
              loading={regenerate.isPending}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
      </View>

      {toast && <Toast message={toast} />}
    </Atmosphere>
  )
}
