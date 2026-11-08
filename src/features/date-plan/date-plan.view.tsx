import { AppHeader } from '@/shared/ui/app-header.view'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'

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
import { costLineText, planCost, stopCostLabel } from '@/shared/pricing/plan-cost'
import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { useScreenFocused } from '@/shared/hooks/use-screen-focused'
import { ErrorState, OfflineState } from '@/shared/ui/async-state.view'
import { RoomConnectionNotice } from '@/shared/ui/room-connection-notice.view'
import { haptic } from '@/shared/ui/feedback'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { GlassBar } from '@/shared/ui/glass-bar.view'
import { Atmosphere, Card, Chip, GhostBtn, PrimaryBtn, Toast } from '@/shared/ui/primitives'
import { PlanSkeleton } from '@/shared/ui/skeleton.view'
import { Icon } from '@/shared/ui/icons'
import { PlaceAddressText } from '@/shared/ui/place-address.view'
import { Text } from '@/shared/ui/text'
import { hitSlop, spacing } from '@/shared/ui/tokens'

import { planStep, useRoomStepShown } from '@/shared/navigation/room-steps'

import { PlaceDetailEmptyHero } from './place-detail-empty-hero.view'
import { styles } from './date-plan.style'
import { planStart, planWhen } from './plan-title'
import { goBackOrHome } from '@/shared/navigation/go-back-or-home'


export default function DatePlanScreen() {
  const { t } = useTranslation()
  const router = useRouter()
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
  const onTop = useScreenFocused()
  const realtime = useRoomRealtime(summary?.roomId, 'plan', { enabled: onTop })
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
          ? t('datePlan.regeneratedKept', { count: kept })
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
    <View>
      <AppHeader onBack={() => goBackOrHome(router)} title={screenTitle()} />
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
  // A finished date is read-only: nothing left to lock, rebuild or edit. The
  // server still decides; this only stops offering what no longer applies.
  const editable = roomStatus !== 'completed'

  function renderDateAction() {
    if (!room.data) {
      return room.isError ? (
        <View style={styles.startNotice} accessibilityLiveRegion="polite">
          <Text variant="bodySmall" color="text.secondary" style={styles.startNoticeLabel}>{t('datePlan.roomUnavailable')}</Text>
          <GhostBtn label={t('common.retry')} onPress={() => void room.refetch()} />
        </View>
      ) : (
        <PrimaryBtn label={t('datePlan.go')} onPress={onStart} disabled loading icon="arrowRight" style={styles.goBtn} />
      )
    }
    if (roomStatus === 'active') {
      return <PrimaryBtn label={t('datePlan.enter')} onPress={openActiveDate} icon="arrowRight" style={styles.goBtn} />
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
            icon="arrowRight"
            style={styles.goBtn}
          />
          {startDate.isError || notStarted ? (
            <Text variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite" style={styles.startError}>
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
        <Text variant="bodySmall" color="text.secondary" style={styles.startNoticeLabel}>
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
  const legs = summary.stops.map(stop => stop.travelMinutesFromPrev).filter((n): n is number => n != null)
  const legMinutes = legs.length > 0 ? legs.reduce((sum, n) => sum + n, 0) : null
  const cost = planCost(summary, room.data ? toRoomAudience(room.data) : null, t)

  return (
    <Atmosphere>
      <View>
        <AppHeader
          onBack={() => goBackOrHome(router)}
          title={screenTitle()}
        />
      </View>
      <RoomConnectionNotice
        roomId={summary.roomId}
        status={realtime.status}
        visible={onTop}
        error={plan.isError ? plan.error : null}
        onRetry={() => void plan.refetch()}
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: 240 }}>
        {/* A plan built before the last constraint edit is no longer the answer. */}
        {summary.isStale ? (
          <View style={styles.warningCard}>
            <Icon name="alert" size={16} color="status.warningText" />
            <Text variant="bodySmall" color="status.warningText" style={styles.staleText}>{t('datePlan.stale')}</Text>
          </View>
        ) : null}

        {/* Someone edited or rebuilt this plan — possibly on another device. */}
        {summary.status === 'superseded' ? (
          <Pressable
            onPress={() => router.replace(`/room/${summary.roomId}`)}
            accessibilityRole="button"
          >
            <View style={styles.warningCard}>
              <Icon name="alert" size={16} color="status.warningText" />
              <Text variant="bodySmall" color="status.warningText" style={styles.staleText}>{t('datePlan.superseded')}</Text>
            </View>
          </Pressable>
        ) : null}

        <Card style={styles.summaryCard}>
          {cost.primary ? <View style={styles.summaryTotalRow}>
            <Text variant="body" color="text.secondary">{t('datePlan.totalCost')}</Text>
            <View style={styles.summaryTotalValue}>
              {/* One formatter owns the amount and its scope (GoGo-MobileApp#249).
                  They are separate texts so the scope wraps under the amount
                  instead of being truncated off a narrow screen. */}
              <View style={styles.summaryAmountRow}>
                {cost.primary.amount ? <Text variant="title1" color="accent.primary">{cost.primary.amount}</Text> : null}
                <Text variant={!(cost.primary.amount) ? 'title2' : cost.primary.amount ? 'caption' : undefined} color={!(cost.primary.amount) ? 'text.primary' : cost.primary.amount ? 'text.secondary' : undefined}>{cost.primary.unit}</Text>
              </View>
              {cost.secondary ? (
                <Text variant="caption" color="status.successText" style={styles.summarySecondary}>{costLineText(cost.secondary)}</Text>
              ) : null}
              {/* Computed from the upper bound — never soften it. */}
              {summary.overBudget ? (
                <Text variant="caption" color="status.dangerText" style={styles.summaryOverBudget} numberOfLines={1}>
                  {t('datePlan.overBudget')}
                </Text>
              ) : null}
            </View>
          </View> : null}
          {cost.primary ? <View style={styles.summaryDivider} /> : null}
          <View style={styles.summaryTimeRow}>
            <Text variant="body" color="text.secondary">{t('datePlan.time')}</Text>
            <Text variant="title2">
              {Math.floor(summary.durationMinutes / 60)}h {summary.durationMinutes % 60}m
            </Text>
          </View>
          {/* Sum of the optimizer's legs; hidden when the plan has none. */}
          {legMinutes != null ? (
            <>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryTimeRow}>
                <Text variant="body" color="text.secondary">{t('datePlan.travel')}</Text>
                <Text variant="title2">{t('datePlan.minutes', { n: legMinutes })}</Text>
              </View>
            </>
          ) : null}
        </Card>

        <View style={styles.sectionRow}>
          <Text variant="title2">{t('datePlan.itinerary')}</Text>
          {capabilities.canLockStops && editable ? (
            <Text variant="caption" color="text.secondary" style={styles.sectionHint}>{t('datePlan.itineraryHint')}</Text>
          ) : null}
        </View>

        {summary.stops.map((stop, index) => {
          const place = places.byPlaceId.get(stop.placeId)
          const name = place?.name ?? ''
          const stopCost = stopCostLabel(stop, summary.currency, t)

          return (
            <View key={stop.id}>
              {stop.travelMinutesFromPrev != null && index > 0 && (
                <View style={styles.legRow}>
                  <View style={styles.legLine} />
                  {/* Minutes and distance both come from the optimizer. The
                      contract carries no travel *mode*, so none is claimed. */}
                  <View style={styles.legRail}>
                    <Text variant="bodySmall" color="text.secondary">
                      {t('datePlan.travelLeg', { n: stop.travelMinutesFromPrev })}
                    </Text>
                    {stop.travelDistanceMFromPrev != null ? (
                      <Text variant="bodySmall" color="text.secondary">
                        · {formatDistance(stop.travelDistanceMFromPrev)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/places/${stop.placeId}`)}
              >
                <Card
                  padded={false}
                  style={[styles.stopCard, stop.status === 'completed' && styles.stopCardCompleted]}
                >
                  <View style={styles.stopHero}>
                    {place?.photoUrl ? (
                      <PlacePhoto placeId={stop.placeId} name={name} uri={place.photoUrl} style={styles.stopImage} />
                    ) : (
                      <View style={styles.stopImage}><PlaceDetailEmptyHero /></View>
                    )}
                    <View pointerEvents="none" style={styles.stopScrim} />
                    <View style={styles.stopHeroTop}>
                      <View style={styles.stopOrderBadge}>
                        <Text variant="label" color="text.inverse">{t('datePlan.stopOrder', { n: index + 1 })}</Text>
                      </View>
                      <View style={styles.stopBadges}>
                        {stop.status === 'completed' ? (
                          <Chip label={t('datePlan.done')} variant="positive" />
                        ) : null}
                        {/* Locked reads as locked without colour: padlock and word. */}
                        {stop.isLocked && !(capabilities.canLockStops && editable) ? (
                          <Chip label={t('datePlan.locked')} icon="lock" variant="warning" />
                        ) : null}
                        {/* Host-only, and server-enforced. */}
                        {capabilities.canLockStops && editable && (
                          <Pressable
                            onPress={() => toggleLock(stop, name)}
                            accessibilityRole="togglebutton"
                            accessibilityState={{ checked: stop.isLocked }}
                            accessibilityLabel={t(stop.isLocked ? 'datePlan.unlockHint' : 'datePlan.lockHint')}
                            hitSlop={hitSlop}
                            style={[styles.lockBtn, stop.isLocked ? styles.lockBtnOn : styles.lockBtnOff]}
                          >
                            <Icon name={stop.isLocked ? 'lock' : 'unlock'} size={14} color={stop.isLocked ? 'accent.onAccent' : 'text.primary'} />
                            <Text variant="caption" color={stop.isLocked ? 'accent.onAccent' : 'text.primary'}>
                              {t(stop.isLocked ? 'datePlan.locked' : 'datePlan.lockable')}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                    <View pointerEvents="none" style={styles.stopHeroBottom}>
                      <Text variant="title1" color="text.inverse" numberOfLines={1}>{name}</Text>
                      {place ? (
                        <PlaceAddressText place={place} variant="bodySmall" color="text.inverse" numberOfLines={1} />
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.stopInfo}>
                    <View style={styles.stopTime}>
                      <Icon name="clock" size={16} color="text.secondary" />
                      {/* A room with no `startAt` gets no scheduled times: the duration stands in. */}
                      <Text variant="bodySmall" color="text.secondary">
                        {stop.arriveLabel && stop.departLabel
                          ? `${stop.arriveLabel} - ${stop.departLabel}`
                          : t('datePlan.minutes', { n: stop.durationMinutes })}
                      </Text>
                    </View>
                    {stopCost ? <Text variant="title2" color="accent.primary" style={styles.stopPrice}>{stopCost}</Text> : null}
                  </View>
                </Card>
              </Pressable>
            </View>
          )
        })}
        {capabilities.canRegenerate && editable ? (
          <GhostBtn label={t('planChange.title')} onPress={() => router.push(`/plans/${planId}/change`)} />
        ) : null}
      </ScrollView>

      <GlassBar placement="floating">
        {/* Starting or opening the date is the one dominant CTA; edit and rebuild sit above it. */}
        <View style={styles.secondaryRow}>
          {capabilities.canRegenerate && editable ? (
            <Pressable
              onPress={rebuild}
              disabled={regenerate.isPending}
              accessibilityRole="button"
              accessibilityLabel={`${t('datePlan.regenerate')}, ${t('datePlan.regenerateSub')}`}
              accessibilityState={{ disabled: regenerate.isPending, busy: regenerate.isPending }}
              style={({ pressed }) => [styles.rebuildBtn, pressed && styles.rebuildBtnPressed]}
            >
              <Text variant="label">{regenerate.isPending ? t('datePlan.regenerating') : t('datePlan.regenerate')}</Text>
              <Text variant="caption" color="text.secondary" numberOfLines={1} ellipsizeMode="tail">
                {t('datePlan.regenerateSub')}
              </Text>
            </Pressable>
          ) : null}
          {capabilities.isHost && editable ? (
            <GhostBtn label={t('datePlan.edit')} onPress={() => router.push(`/plans/${planId}/edit`)} style={styles.editBtn} />
          ) : null}
        </View>
        {renderDateAction()}
      </GlassBar>

      {toast && <Toast message={toast} />}
    </Atmosphere>
  )
}
