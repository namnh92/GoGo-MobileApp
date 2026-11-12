import { BlockingLoadingOverlay } from '@/shared/ui/blocking-loading-overlay.view'
import { AppHeader } from '@/shared/ui/app-header.view'
import { useLocalSearchParams, useNavigationContainerRef, useRouter } from 'expo-router'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessibilityInfo, ScrollView, View } from 'react-native'

import {
  memberProgress,
  roomCapabilities,
  type RoomSummary,
  useCurrentPlan,
  useCurrentSuggestions,
  useRoom,
  useSeedPlaceDetails,
  useRoomRealtime,
  useStartMatching,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { roomBudgetLabel } from '@/shared/pricing/budget-unit'
import { isUuid } from '@/shared/navigation/deep-link'
import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { decisionScreen, PLAN_RETRY_NOTICE, PLAN_UNAVAILABLE_NOTICE } from '@/shared/navigation/room-routing'
import { markRoomStepShown, planStep, runStep, wasRoomStepShown } from '@/shared/navigation/room-steps'
import { alertWithHold, useRoutingHold } from '@/shared/navigation/routing-hold'
import { EmptyState, ErrorState, OfflineState } from '@/shared/ui/async-state.view'
import { RoomConnectionNotice } from '@/shared/ui/room-connection-notice.view'
import { administrativeAreaLabel } from '@/shared/administrative/snapshot'
import { Atmosphere, Card, IconBtn, PrimaryBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { RoomMemberSkeleton } from '@/shared/ui/skeleton.view'
import { Icon, type IconName } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { PullToRefresh } from '@/shared/ui/refresh-control.view'
import { GlassBar, useBottomBarInset } from '@/shared/ui/glass-bar.view'
import { spacing } from '@/shared/ui/tokens'

import { roomScheduleRangeLabel } from './room-schedule'
import { styles } from './gogo-room.style'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { styles as sectionStyles } from './room-section.style'
import { RoomSectionHeading } from './room-section.view'
import { RoomFacts } from './room-facts.view'
import { RoomMembers } from './room-members.view'
import { RoomSeeds } from './room-seeds.view'
import { useRoomHostActions } from './room-host-actions.view'
import { useScreenFocused } from '@/shared/hooks/use-screen-focused'
import { goBackOrHome } from '@/shared/navigation/go-back-or-home'

/** The API mints invites only while a room still takes members (GoGo-BE `createInvite`). */
const JOINABLE: readonly RoomSummary['status'][] = ['draft', 'collecting']
/** How often, and how many times, the lobby looks again for a navigator that is not ready yet. */
const NAV_RETRY_MS = 50
const NAV_ATTEMPTS_MAX = 20

type RowTone = 'accent' | 'info' | 'success' | 'warning'

/** One fact of the room: a tinted icon tile and its value. */
function InfoRow({ icon, tone, label, children }: { icon: IconName; tone: RowTone; label: string; children: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, styles[`infoIcon_${tone}`]]}>
        <Icon name={icon} size={18} color={ROW_ICON[tone]} />
      </View>
      <View style={styles.infoValue}><Text variant="caption" color="text.secondary">{label}</Text><Text variant="body">{children}</Text></View>
    </View>
  )
}

const ROW_ICON: Record<RowTone, 'accent.primary' | 'status.infoText' | 'status.successText' | 'status.warningText'> = {
  accent: 'accent.primary',
  info: 'status.infoText',
  success: 'status.successText',
  warning: 'status.warningText',
}

export default function GoGoRoomScreen() {
  const [actionHeight, setActionHeight] = useState(0)
  const actionInset = useBottomBarInset(actionHeight)
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { roomId, notice } = useLocalSearchParams<{ roomId: string; notice?: string }>()
  // GoGo-MobileApp#203: a param that is not a room id — an invite code in a room
  // link, or an id that never arrived — must not reach the API as
  // `GET /rooms/<junk>`. Every read below is keyed off the checked id.
  const validRoomId = isUuid(roomId) ? roomId : undefined

  const rememberRoom = useRecentRoomsStore(state => state.remember)
  const room = useRoom(validRoomId)
  const summary = room.data
  const capabilities = roomCapabilities(summary)
  const waitingForNetwork = useWaitingForNetwork(room)
  // Members join and finish picking while this screen is open; the realtime
  // layer owns how that freshness arrives.
  const focused = useScreenFocused()
  const realtime = useRoomRealtime(validRoomId, 'lobby', { enabled: focused && validRoomId !== undefined })
  const seedDetails = useSeedPlaceDetails(summary?.seedPlaces ?? [])
  const startMatching = useStartMatching(roomId)
  const starting = useRef(false)

  useEffect(() => {
    if (summary) rememberRoom(summary)
  }, [summary, rememberRoom])

  // GoGo-MobileApp#198 — where the room is decides where everyone belongs, a
  // member as much as the host. The lobby only ever showed who had picked, so a
  // member sat here while the host's run and plan landed.
  const status = summary?.status
  // Read only while this screen is on top: under the deck or the plan they
  // would refetch on every tick of that screen's poll for nothing.
  const suggestions = useCurrentSuggestions(focused && status === 'matching' ? validRoomId : undefined)
  const decided = status === 'ready' || status === 'active'
  const currentPlan = useCurrentPlan(focused && decided ? validRoomId : undefined)
  // Only facts read since this screen opened move anyone, judged by the clock.
  // The cache is persisted for a day, and on a cold start its restore can land
  // after this screen mounts, carrying the old read's counters with it — so
  // "fetched after mount" would pass an hour-old room and send a member to a
  // closed vote or a replaced plan.
  const [openedAt] = useState(() => Date.now())
  const confirmed = (query: { isSuccess: boolean; dataUpdatedAt: number }) =>
    query.isSuccess && query.dataUpdatedAt >= openedAt
  const runId = status === 'matching' && confirmed(suggestions) ? suggestions.data?.run?.id : undefined
  const screen = runId ? decisionScreen(summary?.decisionMode, status, suggestions.data) : null
  const fetchedPlanId = decided && confirmed(currentPlan) ? currentPlan.data?.id : undefined
  const planId = isUuid(fetchedPlanId) ? fetchedPlanId : undefined
  const next = !validRoomId || !confirmed(room)
    ? null
    : screen && runId
      ? { step: runStep(runId), path: `/room/${validRoomId}/${screen}` }
      : planId
        ? { step: planStep(planId), path: `/plans/${planId}` }
        : null

  // A share sheet or a confirmation is up: the person is mid-action here.
  const routingHold = useRoutingHold()
  const hostActions = useRoomHostActions(summary, validRoomId, routingHold.hold)
  // A start that failed after the server had made its run leaves the host here;
  // counting failures makes the routing below look again.
  const [startFailures, setStartFailures] = useState(0)
  const navigation = useNavigationContainerRef()
  const navAttempts = useRef({ step: '', count: 0, gaveUp: false })
  const [navTick, setNavTick] = useState(0)
  // Shown again, the lobby gets a fresh set of attempts. Declared before the
  // routing effect, so a re-focus resets them before it runs.
  useEffect(() => {
    if (focused) navAttempts.current = { step: '', count: 0, gaveUp: false }
  }, [focused])

  const planNotice = notice === PLAN_UNAVAILABLE_NOTICE || notice === PLAN_RETRY_NOTICE ? notice : null
  // Once the plan is known, the notice explaining its absence is not true any
  // more. Declared before the move below, so it clears this route's params.
  useEffect(() => {
    if (planNotice && planId) router.setParams({ notice: undefined })
  }, [planNotice, planId, router])
  useEffect(() => {
    if (!planNotice) return
    // The live region below is Android-only; VoiceOver needs the announcement.
    AccessibilityInfo.announceForAccessibility(
      planNotice === PLAN_RETRY_NOTICE ? t('gogoRoom.planRetry') : t('gogoRoom.planUnavailable'),
    )
  }, [planNotice, t])

  const nextStep = next?.step
  const nextPath = next?.path
  useEffect(() => {
    if (!validRoomId || !nextStep || !nextPath) return
    // Only the screen on top moves anyone, and a host starting the run moves
    // themselves (`beginMatching`).
    if (!focused || routingHold.held || starting.current) return
    // Once per change. The screen that shows a step records it, so coming back
    // here — Back, "Về phòng chờ", a superseded plan — never sends anyone round.
    if (wasRoomStepShown(validRoomId, nextStep)) return
    if (navAttempts.current.step !== nextStep) navAttempts.current = { step: nextStep, count: 0, gaveUp: false }
    const lookAgain = (reason: 'navigator_not_ready' | 'push_failed') => {
      const attempts = navAttempts.current
      if (attempts.count >= NAV_ATTEMPTS_MAX) {
        // Said once per step, with no ids: which kind of move, and why not.
        if (!attempts.gaveUp) {
          track('room_route_gave_up', { destination: nextStep.startsWith('plan:') ? 'plan' : 'decision', reason })
        }
        attempts.gaveUp = true
        return undefined
      }
      attempts.count += 1
      const timer = setTimeout(() => setNavTick(tick => tick + 1), NAV_RETRY_MS)
      return () => clearTimeout(timer)
    }
    // A room opened cold renders its lobby in the pass that mounts the
    // navigator, and expo-router refuses a push until that pass is done.
    if (!navigation.isReady()) return lookAgain('navigator_not_ready')
    try {
      router.push(nextPath)
    } catch {
      // Not pushed is not shown: nothing is recorded, and it is tried again.
      return lookAgain('push_failed')
    }
    markRoomStepShown(validRoomId, nextStep)
  }, [validRoomId, nextStep, nextPath, focused, routingHold.held, startFailures, navTick, navigation, router])

  if (!validRoomId) {
    return (
      <Atmosphere>
        <View>
          <AppHeader title={t('gogoRoom.screenTitle')} onBack={() => goBackOrHome(router)} />
        </View>
        <EmptyState
          title={t('guestJoin.notFoundTitle')}
          body={t('guestJoin.notFoundBody')}
          action={<SecondaryBtn label={t('shareLink.goHome')} onPress={() => router.replace('/(tabs)')} />}
        />
      </Atmosphere>
    )
  }

  if (room.isPending) {
    return (
      <Atmosphere>
        <View>
          <AppHeader title={t('gogoRoom.screenTitle')} onBack={() => goBackOrHome(router)} />
        </View>
        {/* Nothing cached and offline: the paused read would keep the skeleton forever (#253). */}
        {waitingForNetwork ? (
          <OfflineState />
        ) : (
          <>
            {/* Still waiting on the room: how its updates arrive is already known (#292). */}
            <RoomConnectionNotice roomId={validRoomId} status={realtime.status} visible={focused} hasData={false} />
            <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[6] }}>
              <RoomMemberSkeleton count={3} />
            </View>
          </>
        )}
      </Atmosphere>
    )
  }

  // A failed refetch must not throw away a cached plan; the error screen is
  // only for having nothing at all to show (APP-007).
  if (!summary) {
    return (
      <Atmosphere>
        <View>
          <AppHeader title={t('gogoRoom.screenTitle')} onBack={() => goBackOrHome(router)} />
        </View>
        <ErrorState error={room.error} onRetry={() => void room.refetch()} />
      </Atmosphere>
    )
  }

  const roomType = summary.type
  const progress = memberProgress(summary)
  const joinable = JOINABLE.includes(summary.status)
  // The same facts the auto-route reads: a confirmed run that sends this member to the deck,
  // and at least one card still without their vote. Finished, empty or moved on: no button.
  const mineVotes = suggestions.data?.votes?.mine
  const candidatesLeft = (suggestions.data?.candidates ?? []).some(c => c.placeId && !mineVotes?.[c.placeId])
  const continueVoting = status === 'matching' && screen === 'swipe' && candidatesLeft && Boolean(nextPath)
  const startVisible =
    capabilities.isHost && (summary.matching?.canStart ?? (progress.completed >= 2 && progress.completed === progress.total))

  async function beginMatching(allowIncompletePreferences = false) {
    if (starting.current) return
    starting.current = true
    try {
      const started = await startMatching.mutateAsync({ allowIncompletePreferences })
      // The host's own way on; the run it opens must not send them a second time.
      if (validRoomId && started?.run?.id) markRoomStepShown(validRoomId, runStep(started.run.id))
      router.push(`/room/${roomId}/matching`)
    } catch {
      // The mutation's error state renders below; the room stays usable. The
      // server may have made its run anyway, so the routing looks again.
      setStartFailures(n => n + 1)
    } finally {
      starting.current = false
    }
  }

  function confirmPartialMatching() {
    alertWithHold(routingHold.hold, t('gogoRoom.partialTitle'), t('gogoRoom.partialBody', { count: summary?.matching?.pendingCount }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('gogoRoom.partialContinue'), onPress: () => { void beginMatching(true) } },
    ])
  }

  // Owner sim 2026-11-12: one measured bottom action bar for every lobby.
  const actions = <View style={styles.actions}>
    {/* Back must not auto-open a run again, but a person can explicitly
        return to its current decision screen without saving preferences. */}
    {continueVoting && nextPath ? (
      <PrimaryBtn
        label={t('gogoRoom.continueVoting')}
        onPress={() => router.push(nextPath)}
        disabled={routingHold.held || startMatching.isPending}
      />
    ) : screen && nextPath ? (
      <SecondaryBtn
        label={t(screen === 'swipe' ? 'gogoRoom.returnToVote' : 'gogoRoom.returnToResult')}
        onPress={() => router.push(nextPath)}
        disabled={routingHold.held || startMatching.isPending}
      />
    ) : null}

    {/*
      One dominant CTA per screen (spec §7). Choosing your own preferences
      is the room's main job; once everyone has finished, the host's start
      takes over as the dominant one. Host-only either way, and
      server-enforced. Inviting lives in the header.
    */}
    {!capabilities.isHost && joinable ? <View style={styles.waitingNotice}><Icon name="clock" size={20} color="text.secondary" /><Text variant="bodySmall" color="text.secondary" style={styles.infoValue}>{t('roomLobby.waitHost')}</Text></View> : null}
    {startVisible || continueVoting ? (
      <SecondaryBtn
        label={t('gogoRoom.myPreferences')}
        onPress={() => router.push(`/room/${roomId}/preference`)}
        style={styles.stackedBtn}
      />
    ) : (
      <PrimaryBtn
        label={t('gogoRoom.myPreferences')}
        onPress={() => router.push(`/room/${roomId}/preference`)}
      />
    )}

    {capabilities.isHost && summary.matching?.blockedReason === 'MATCHING_QUORUM_REQUIRED' ? (
      <Text variant="caption" color="text.secondary" style={styles.actionHint}>{t('gogoRoom.quorumRequired')}</Text>
    ) : null}

    {startVisible ? (
      continueVoting ? (
        <SecondaryBtn
          label={startMatching.isPending ? t('gogoRoom.starting') : t('gogoRoom.startMatching')}
          onPress={() => { void beginMatching() }}
          loading={startMatching.isPending}
        />
      ) : (
        <PrimaryBtn
          label={startMatching.isPending ? t('gogoRoom.starting') : t('gogoRoom.startMatching')}
          onPress={() => { void beginMatching() }}
          loading={startMatching.isPending}
        />
      )
    ) : null}

    {capabilities.isHost && summary.matching?.canStartWithIncomplete ? (
      <SecondaryBtn label={t('gogoRoom.partialContinue')} onPress={confirmPartialMatching} loading={startMatching.isPending} />
    ) : null}

    {startMatching.isError ? (
      <Text variant="bodySmall" color="status.dangerText" accessibilityLiveRegion="polite" style={styles.error}>
        {t('gogoRoom.startFailed')}
      </Text>
    ) : null}

  </View>

  return (
    <Atmosphere>
      <BlockingLoadingOverlay visible={startMatching.isPending} />
      {hostActions.dialogs}
      <View>
        <AppHeader titleNumberOfLines={1} testID="room-lobby-header" title={summary.title?.trim() || t(roomType === 'couple' ? 'roomLobby.coupleTitle' : capabilities.isHost ? 'gogoRoom.title_group' : 'roomLobby.group')} rightAction={hostActions.headerAction} onBack={() => goBackOrHome(router)} />
      </View>
      <RoomConnectionNotice
        roomId={validRoomId}
        status={realtime.status}
        visible={focused}
        error={room.isError ? room.error : null}
        onRetry={() => void room.refetch()}
      />
      {planNotice ? (
        <Text variant="bodySmall" color="text.secondary" accessibilityLiveRegion="polite" style={styles.notice}>
          {planNotice === PLAN_RETRY_NOTICE ? t('gogoRoom.planRetry') : t('gogoRoom.planUnavailable')}
        </Text>
      ) : null}
      <PullToRefresh onRefresh={async () => { await Promise.all([room.refetch(), hostActions.refresh(), seedDetails.refetchAll()]) }}>
      <ScrollView testID="room-lobby-scroll" contentContainerStyle={[styles.content, { paddingBottom: actionInset + spacing[4] }]}>
        {hostActions.feedback}
        {/* What the room is actually constrained by — facts, composed here. */}
        <Card testID="room-lobby-conditions" style={sectionStyles.card}>
            <RoomSectionHeading icon="sliders" title={t('gogoRoom.constraints')} compactAction={capabilities.isHost
              ? actionStyle => <IconBtn style={actionStyle} variant="plainCompact" accessibilityLabel={t('roomLobby.editConditions')} onPress={() => router.push(`/room/${roomId}/edit`)}><MaterialIcon name="edit" size={20} color="accent.primary" /></IconBtn>
              : undefined}
              action={capabilities.isHost ? undefined : <Text variant="caption" color="text.secondary">{t('roomLobby.setByHost')}</Text>} />
            <View style={styles.rows}><RoomFacts facts={{
              name: summary.title?.trim()
                ? <InfoRow icon="info" tone="info" label={t('roomTitle.title')}>{summary.title.trim()}</InfoRow> : null,
              area: summary.constraints?.administrativeArea ? <>
                <InfoRow icon="mapPin" tone="accent" label={t('roomLobby.area')}>{administrativeAreaLabel(summary.constraints.administrativeArea)}</InfoRow>
                {summary.constraints.administrativeArea.status === 'needs_reselection' ? (
                  <InfoRow icon="alert" tone="warning" label={t('roomLobby.area')}>{t('gogoRoom.areaNeedsReselection')}</InfoRow>
                ) : null}
              </> : null,
              budget: summary.constraints?.budgetAmount ? (
                <InfoRow icon="dollar" tone="success" label={t('roomManage.budgetTitle')}>
                  {roomBudgetLabel(summary.constraints, summary.participantCount, t)}
                </InfoRow>
              ) : null,
              schedule: summary.constraints?.startAt || summary.scheduledDate ? (
                <InfoRow icon="calendar" tone="info" label={t('roomSchedule.title')}>{roomScheduleRangeLabel(summary, i18n.language, t)}</InfoRow>
              ) : null,
            }} /></View>
          </Card>

        <RoomMembers room={summary} onRefresh={() => room.refetch()} hold={routingHold.hold} />
        <RoomSeeds room={summary} details={seedDetails} onRefresh={() => room.refetch()} hold={routingHold.hold} />
        {hostActions.group}
      </ScrollView>
      </PullToRefresh>
      <GlassBar testID="room-lobby-actions" placement="floating" onHeightChange={setActionHeight}>{actions}</GlassBar>
    </Atmosphere>
  )
}
