import { onlineManager } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams, useNavigationContainerRef, useRouter } from 'expo-router'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessibilityInfo, Platform, ScrollView, Share, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  isRetryable,
  memberProgress,
  roomCapabilities,
  type MemberSelectionStatus,
  type RoomMember,
  type RoomSummary,
  useCreateRoomInvite,
  useCurrentPlan,
  useCurrentSuggestions,
  useRevokeRoomInvite,
  useRoom,
  useRoomInvites,
  useRoomRealtime,
  useStartMatching,
} from '@/shared/api'
import { track } from '@/shared/analytics'
import { env } from '@/shared/config/env'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { useSession } from '@/shared/providers/session-provider'
import { formatMoney } from '@/shared/pricing/money'
import { budgetUnitLabel } from '@/shared/pricing/budget-unit'
import { isUuid } from '@/shared/navigation/deep-link'
import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { decisionScreen, PLAN_RETRY_NOTICE, PLAN_UNAVAILABLE_NOTICE } from '@/shared/navigation/room-routing'
import { markRoomStepShown, planStep, runStep, wasRoomStepShown } from '@/shared/navigation/room-steps'
import { alertWithHold, releaseOnReturn, useRoutingHold } from '@/shared/navigation/routing-hold'
import { EmptyState, ErrorState, OfflineState, StaleNotice } from '@/shared/ui/async-state.view'
import {
  Atmosphere,
  AvatarCircle,
  BackHeader,
  Chip,
  GhostBtn,
  GlassCard,
  IconBtn,
  PrimaryBtn,
  SecondaryBtn,
} from '@/shared/ui/primitives'
import { RoomMemberSkeleton, Skeleton } from '@/shared/ui/skeleton.view'
import { IconCheck, IconCopy, IconUserOutline } from '@/shared/ui/icons'
import { colors, glyph, spacing } from '@/shared/ui/tokens'

import { resolveInviteDisplay } from './invite-state'
import { roomScheduleLabel } from './room-schedule'
import { styles } from './gogo-room.style'
import { useScreenFocused } from '@/shared/hooks/use-screen-focused'

const { brand } = colors

const AVATAR_COLORS = [brand.coral, brand.lavender, brand.mint, brand.amber]
const VISIBLE_AVATARS = 3
/** The API mints invites only while a room still takes members (GoGo-BE `createInvite`). */
const JOINABLE: readonly RoomSummary['status'][] = ['draft', 'collecting']
/** How often, and how many times, the lobby looks again for a navigator that is not ready yet. */
const NAV_RETRY_MS = 50
const NAV_ATTEMPTS_MAX = 20

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

/**
 * The lobby's whole job is answering "are we waiting on anyone?" (spec §16).
 * `selectionStatus` already carries that; before this it only fed a counter,
 * so a host could see 2/4 without knowing which two.
 */
const STATUS_CHIP: Record<MemberSelectionStatus, { key: string; variant: 'default' | 'info' | 'positive' }> = {
  pending: { key: 'gogoRoom.status.waiting', variant: 'default' },
  in_progress: { key: 'gogoRoom.status.choosing', variant: 'info' },
  completed: { key: 'gogoRoom.status.completed', variant: 'positive' },
}

export default function GoGoRoomScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { roomId, notice } = useLocalSearchParams<{ roomId: string; notice?: string }>()
  // GoGo-MobileApp#203: a param that is not a room id — an invite code in a room
  // link, or an id that never arrived — must not reach the API as
  // `GET /rooms/<junk>`. Every read below is keyed off the checked id.
  const validRoomId = isUuid(roomId) ? roomId : undefined

  const rememberRoom = useRecentRoomsStore(state => state.remember)
  const [codeCopied, setCodeCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const room = useRoom(validRoomId)
  const summary = room.data
  const capabilities = roomCapabilities(summary)
  const waitingForNetwork = useWaitingForNetwork(room)
  // Members join and finish picking while this screen is open; the realtime
  // layer owns how that freshness arrives.
  const focused = useScreenFocused()
  useRoomRealtime(validRoomId, 'lobby', { enabled: focused && validRoomId !== undefined })
  // Invites are host-only on the server; a member's device neither lists them
  // nor reads a stored code (#199).
  const inviteRoomId = capabilities.canInvite ? validRoomId : undefined
  const invites = useRoomInvites(inviteRoomId)
  const createInvite = useCreateRoomInvite(inviteRoomId)
  const revokeInvite = useRevokeRoomInvite(validRoomId ?? '')
  const startMatching = useStartMatching(roomId)
  const starting = useRef(false)

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

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


  // A cold start can restore the room and its invites from disk before the
  // session is back. Until it is, this device's stored code is unknown, not
  // absent: judging then would offer to re-issue the host's own live code.
  const sessionHydrating = useSession().status === 'hydrating'
  const [inviteClock, setInviteClock] = useState(() => Date.now())
  // The API lists invites without codes; this device holds the code it created.
  const storedInvite = createInvite.stored
  const { display: inviteDisplay, forget: forgetStoredInvite } = resolveInviteDisplay({
    stored: !inviteRoomId ? null : sessionHydrating ? undefined : storedInvite,
    invites: invites.data,
    // Paused (offline) with nothing loaded is as unreadable as a failure.
    invitesFailed: invites.isError || (invites.isPaused && invites.data === undefined),
    listIsCurrent: invites.status === 'success' && !invites.isFetching
      && invites.dataUpdatedAt > (storedInvite?.savedAt ?? 0),
    now: inviteClock,
  })
  const shownExpiry = inviteDisplay.kind === 'code' || inviteDisplay.kind === 'active-elsewhere'
    ? inviteDisplay.expiresAt : null
  useEffect(() => {
    if (!shownExpiry) return
    const remaining = Date.parse(shownExpiry) - Date.now()
    const timer = setTimeout(() => setInviteClock(Date.now()), Math.min(Math.max(0, remaining), 2_147_483_647))
    return () => clearTimeout(timer)
  }, [shownExpiry, inviteClock])
  // Revoked, expired, used up or no longer listed: the code can never let anyone in.
  const deadInviteId = forgetStoredInvite ? storedInvite?.inviteId : undefined
  const forgetInvite = createInvite.forget
  useEffect(() => {
    if (deadInviteId) void forgetInvite(deadInviteId)
  }, [deadInviteId, forgetInvite])
  // Another phone can revoke or re-issue while this one is in the background.
  const refetchInvites = invites.refetch
  useEffect(() => {
    if (focused && inviteRoomId) void refetchInvites({ cancelRefetch: false })
  }, [focused, inviteRoomId, refetchInvites])
  const inviteCode = inviteDisplay.kind === 'code' ? inviteDisplay.code : null
  const creatingInvite = useRef(false)
  async function generateInvite() {
    if (!capabilities.canInvite || creatingInvite.current || inviteDisplay.kind !== 'none') return
    creatingInvite.current = true
    try {
      await createInvite.mutateAsync({ maxUses: 20 })
    } catch {
      // Never retry from render, polling or foreground events.
    } finally {
      creatingInvite.current = false
    }
  }

  const [reissueFailed, setReissueFailed] = useState(false)
  // A failed re-issue belongs to the card state it happened in; adjusted during
  // render so the message goes the moment the card moves on.
  const [reissueKind, setReissueKind] = useState(inviteDisplay.kind)
  if (reissueKind !== inviteDisplay.kind) {
    setReissueKind(inviteDisplay.kind)
    setReissueFailed(false)
  }
  /**
   * Other devices hold the codes: revoke every usable invite (duplicates would
   * keep letting people in), then mint exactly one new one.
   */
  /**
   * The usable set as the server has it at confirmation, not as the card last
   * saw it: an invite another phone created meanwhile must be revoked too.
   * `null` when this device's own code turns out to be the live one.
   */
  async function usableInviteIds(seen: readonly string[]): Promise<readonly string[] | null> {
    if (!onlineManager.isOnline()) return seen
    const fresh = await invites.refetch({ cancelRefetch: false })
    if (fresh.status !== 'success') return seen
    const { display } = resolveInviteDisplay({
      stored: storedInvite ?? null,
      invites: fresh.data,
      invitesFailed: false,
      listIsCurrent: true,
      now: Date.now(),
    })
    if (display.kind === 'code') return null
    return display.kind === 'active-elsewhere' ? display.inviteIds : []
  }

  async function reissueInvite(inviteIds: readonly string[]) {
    if (!capabilities.canInvite || creatingInvite.current) return
    creatingInvite.current = true
    // #198 — the lobby must not route the host away while old codes are revoked
    // and the new one is made; the new code is shown here.
    const release = routingHold.hold()
    setReissueFailed(false)
    try {
      try {
        const current = await usableInviteIds(inviteIds)
        if (current === null) return
        for (const inviteId of current) await revokeInvite.mutateAsync(inviteId)
      } catch {
        setReissueFailed(true)
        return
      }
      // One create per confirmed re-issue; a failure shows below and waits for the host.
      await createInvite.mutateAsync({ maxUses: 20 }).then(() => setReissueFailed(false), () => undefined)
    } finally {
      creatingInvite.current = false
      release()
    }
  }

  function confirmReissue(inviteIds: readonly string[]) {
    // A confirmation is up: routing waits until it is answered (#198).
    alertWithHold(
      routingHold.hold,
      t('gogoRoom.reissueTitle'),
      t(inviteIds.length > 1 ? 'gogoRoom.reissueBodyMany' : 'gogoRoom.reissueBody', { n: inviteIds.length }),
      [
        { text: t('gogoRoom.reissueCancel'), style: 'cancel' },
        { text: t('gogoRoom.reissueConfirm'), style: 'destructive', onPress: () => { void reissueInvite(inviteIds) } },
      ],
    )
  }

  if (!validRoomId) {
    return (
      <Atmosphere>
        <View style={{ paddingTop: insets.top }}>
          <BackHeader onBack={() => router.back()} />
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
        <View style={{ paddingTop: insets.top }}>
          <BackHeader onBack={() => router.back()} />
        </View>
        {/* Nothing cached and offline: the paused read would keep the skeleton forever (#253). */}
        {waitingForNetwork ? (
          <OfflineState />
        ) : (
          <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[6] }}>
            <RoomMemberSkeleton count={3} />
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
        <View style={{ paddingTop: insets.top }}>
          <BackHeader onBack={() => router.back()} />
        </View>
        <ErrorState error={room.error} onRetry={() => void room.refetch()} />
      </Atmosphere>
    )
  }

  const roomType = summary.type
  const participantCount = summary.participantCount
  const members = summary.members ?? []
  const progress = memberProgress(summary)
  const inviteUrl = inviteCode ? `${env.webBaseUrl}/r/${inviteCode}` : null
  const joinable = JOINABLE.includes(summary.status)

  function flash(setter: (value: boolean) => void) {
    setter(true)
    timers.current.push(setTimeout(() => setter(false), 2000))
  }

  /**
   * The code as the server still honours it. Another phone may have revoked it
   * since the last refetch, so it is checked before it is handed out; offline,
   * the stored code is still the best answer.
   */
  async function verifiedInviteCode(): Promise<string | null> {
    // A closed room refuses joins (410): there is nothing worth handing out.
    if (!inviteCode || !joinable) return null
    if (!onlineManager.isOnline()) return inviteCode
    const fresh = await invites.refetch({ cancelRefetch: false })
    if (fresh.status !== 'success') return inviteCode
    const { display } = resolveInviteDisplay({
      stored: storedInvite,
      invites: fresh.data,
      invitesFailed: false,
      listIsCurrent: true,
      now: Date.now(),
    })
    return display.kind === 'code' ? display.code : null
  }

  async function copyCode() {
    const code = await verifiedInviteCode()
    if (!code) return
    track('gogo_invite_copied', { channel: 'code' })
    void Clipboard.setStringAsync(code).catch(() => {})
    flash(setCodeCopied)
  }

  async function invite() {
    // Held from the tap: checking the code is a network read, and routing away
    // in that window would open the share sheet over another screen (#198).
    const release = routingHold.hold()
    let shareCalled = false
    try {
      const code = await verifiedInviteCode()
      if (!code) return
      const url = `${env.webBaseUrl}/r/${code}`
      track('gogo_invite_shared', { channel: 'native_share', roomType })
      try {
        // Single share CTA → native share sheet; no hard-coded social buttons.
        shareCalled = true
        await Share.share({ message: `${t('gogoRoom.title', { context: roomType })} ${url}`, url })
      } catch {
        await Clipboard.setStringAsync(url).catch(() => {})
        flash(setLinkCopied)
      }
    } finally {
      // iOS resolves when the sheet closes; Android as soon as the chooser opens.
      if (shareCalled && Platform.OS === 'android') releaseOnReturn(release)
      else release()
    }
  }

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
    alertWithHold(routingHold.hold, t('gogoRoom.partialTitle'), t('gogoRoom.partialBody', { n: summary?.matching?.pendingCount }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('gogoRoom.partialContinue'), onPress: () => { void beginMatching(true) } },
    ])
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}>
        <BackHeader onBack={() => router.back()} />
      </View>
      <StaleNotice error={room.isError ? room.error : null} onRetry={() => void room.refetch()} />
      {planNotice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {planNotice === PLAN_RETRY_NOTICE ? t('gogoRoom.planRetry') : t('gogoRoom.planUnavailable')}
        </Text>
      ) : null}
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: spacing[8] }}>
        {roomType === 'group' ? (
          <View style={{ alignItems: 'center', marginTop: spacing[4], marginBottom: spacing[6] }}>
            <View style={styles.avatarRow}>
              {members.slice(0, VISIBLE_AVATARS).map((member, index) => (
                <View key={member.id} style={styles.avatarWrap}>
                  <AvatarCircle
                    label={initial(member.displayName)}
                    size={56}
                    background={AVATAR_COLORS[index % AVATAR_COLORS.length]}
                    imageUri={member.avatarUrl}
                  />
                </View>
              ))}
              {members.length > VISIBLE_AVATARS && (
                <View style={[styles.avatarWrap, styles.morePeople]}>
                  <Text style={styles.morePeopleLabel}>+{members.length - VISIBLE_AVATARS}</Text>
                </View>
              )}
            </View>
            <Text style={styles.joined}>
              {t('gogoRoom.joined', { joined: members.length, total: participantCount })}
            </Text>
          </View>
        ) : (
          <View style={styles.couplePair}>
            <AvatarCircle label={initial(members[0]?.displayName ?? '')} size={64} imageUri={members[0]?.avatarUrl} />
            <Text style={{ fontSize: glyph.sm }}>+</Text>
            {members[1] ? (
              <AvatarCircle
                label={initial(members[1].displayName)}
                size={64}
                background={brand.lavender}
                imageUri={members[1].avatarUrl}
              />
            ) : (
              <View style={styles.emptySeat}>
                <IconUserOutline />
              </View>
            )}
          </View>
        )}

        <Text style={styles.title}>{summary.title?.trim() || t('gogoRoom.title', { context: roomType })}</Text>
        <Text style={styles.body}>{t('gogoRoom.body', { context: roomType })}</Text>

        {/* What the room is actually constrained by — facts, composed here. */}
        {summary.constraints ? (
          <GlassCard style={styles.constraintsCard}>
            <Text style={styles.constraintsTitle}>{t('gogoRoom.constraints')}</Text>
            <View style={styles.constraintsRow}>
              <Chip
                icon="📅"
                label={roomScheduleLabel(summary.constraints.startAt ?? summary.scheduledDate, i18n.language) ?? t('roomSchedule.unset')}
              />
              <Chip
                label={t('groupSetup.people', { n: participantCount })}
                icon="👥"
                variant="default"
              />
              {summary.constraints.budgetAmount ? (
                <Chip
                  label={`${formatMoney(summary.constraints.budgetAmount, summary.constraints.currency ?? 'VND')} ${budgetUnitLabel(
                    summary.constraints.budgetMode,
                    roomType,
                    t,
                  )}`}
                  icon="💰"
                  variant="default"
                />
              ) : null}
            </View>
          </GlassCard>
        ) : null}

        {/* Per-member status, not just a count (spec §16). */}
        {members.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>
              {t('gogoRoom.membersTitle', { joined: progress.completed, total: progress.total })}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` },
                ]}
              />
            </View>
            <View style={styles.memberList}>
              {members.map((member: RoomMember, index: number) => {
                const chip = STATUS_CHIP[member.selectionStatus]
                return (
                  <GlassCard key={member.id} style={styles.memberRow}>
                    <AvatarCircle
                      label={initial(member.displayName)}
                      size={40}
                      background={AVATAR_COLORS[index % AVATAR_COLORS.length]}
                      imageUri={member.avatarUrl}
                    />
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName} numberOfLines={1}>{member.displayName}</Text>
                      {member.role === 'host' ? (
                        <View style={styles.hostBadge}>
                          <Text style={styles.hostBadgeLabel}>{t('gogoRoom.hostBadge')}</Text>
                        </View>
                      ) : null}
                      {member.isGuest ? (
                        <View style={styles.guestBadge}>
                          <Text style={styles.guestBadgeLabel}>{t('gogoRoom.guestBadge')}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Chip label={t(chip.key)} variant={chip.variant} />
                  </GlassCard>
                )
              })}
            </View>
          </>
        ) : null}

        {capabilities.canInvite ? (
          <GlassCard style={styles.codeCard}>
            <Text style={styles.codeCaption}>{t('gogoRoom.codeLabel')}</Text>
            {/* A room past collecting refuses new invites (409) and joins (410):
                say so rather than show controls that cannot work (RULE-CORE-016). */}
            {!joinable ? <Text style={styles.inviteNote}>{t('gogoRoom.inviteClosed')}</Text> : null}
            {joinable && inviteDisplay.kind === 'none' ? (
              <SecondaryBtn label={t('gogoRoom.createInvite')} onPress={generateInvite}
                loading={createInvite.isPending} disabled={createInvite.isPending || (createInvite.isError && !isRetryable(createInvite.error))} />
            ) : null}
            {joinable && inviteDisplay.kind === 'active-elsewhere' ? (
              <>
                <Text style={styles.inviteNote}>
                  {t('gogoRoom.inviteActive', { time: roomScheduleLabel(inviteDisplay.expiresAt, i18n.language) ?? '' })}
                </Text>
                <SecondaryBtn
                  label={t('gogoRoom.reissueInvite')}
                  onPress={() => confirmReissue(inviteDisplay.inviteIds)}
                  loading={revokeInvite.isPending || createInvite.isPending}
                />
              </>
            ) : null}
            {joinable && inviteDisplay.kind === 'unknown' ? (
              <>
                <Text accessibilityLiveRegion="polite" style={styles.error}>{t('gogoRoom.invitesLoadFailed')}</Text>
                <GhostBtn label={t('common.retry')} onPress={() => void invites.refetch()} />
              </>
            ) : null}
            {reissueFailed ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>{t('gogoRoom.reissueFailed')}</Text>
            ) : null}
            {createInvite.isError ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>{t('gogoRoom.inviteFailed')}</Text>
            ) : null}
            <View style={styles.codeRow}>
              {/* `selectable` so the code can still be lifted by hand if the
                  clipboard write is refused. */}
              {inviteDisplay.kind === 'checking' ? (
                <Skeleton style={styles.codeSkeleton} />
              ) : (
                <Text style={styles.code} selectable numberOfLines={2}>
                  {inviteCode ?? '·····'}
                </Text>
              )}
              {/* Icon-only: a label here gets squeezed by a long code, and this
                  is the only way to lift the code other than the invite link. */}
              <IconBtn
                onPress={() => { void copyCode() }}
                disabled={!inviteCode || !joinable}
                accessibilityLabel={t(codeCopied ? 'common.copied' : 'common.copy')}
                style={[styles.copyBtn, codeCopied && styles.copyBtnDone]}
              >
                {codeCopied ? <IconCheck /> : <IconCopy />}
              </IconBtn>
            </View>
          </GlassCard>
        ) : null}

        {/*
          One dominant CTA per screen (spec §7). Which one it is depends on
          where the room actually is: while people are still picking, inviting
          them is the job; once everyone has finished, starting the match is.
          Host-only either way, and server-enforced.
        */}
        {capabilities.isHost && (summary.matching?.canStart ?? (progress.completed >= 2 && progress.completed === progress.total)) ? (
          <>
            <PrimaryBtn
              label={startMatching.isPending ? t('gogoRoom.starting') : t('gogoRoom.startMatching')}
              onPress={() => { void beginMatching() }}
              loading={startMatching.isPending}
            />
            {capabilities.canInvite ? (
              <SecondaryBtn
                label={linkCopied ? t('gogoRoom.linkCopied') : t('gogoRoom.invite')}
                onPress={invite}
                disabled={!inviteUrl || !joinable}
                style={{ marginTop: spacing[2] }}
              />
            ) : null}
          </>
        ) : capabilities.canInvite ? (
          <PrimaryBtn
            label={linkCopied ? t('gogoRoom.linkCopied') : t('gogoRoom.invite')}
            onPress={invite}
            disabled={!inviteUrl || !joinable}
          />
        ) : null}

        {capabilities.isHost && summary.matching?.canStartWithIncomplete ? (
          <SecondaryBtn label={t('gogoRoom.partialContinue')} onPress={confirmPartialMatching} loading={startMatching.isPending} />
        ) : null}
        {capabilities.isHost && summary.matching?.blockedReason === 'MATCHING_QUORUM_REQUIRED' ? (
          <Text style={styles.body}>{t('gogoRoom.quorumRequired')}</Text>
        ) : null}

        {startMatching.isError ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {t('gogoRoom.startFailed')}
          </Text>
        ) : null}

        <GhostBtn
          label={t('gogoRoom.myPreferences')}
          onPress={() => router.push(`/room/${roomId}/preference`)}
        />

        {capabilities.isHost ? (
          <GhostBtn label={t('roomManage.title')} onPress={() => router.push(`/room/${roomId}/manage`)} />
        ) : null}

        <View style={styles.noApp}>
          <View style={styles.noAppDot} />
          <Text style={styles.noAppLabel}>{t('gogoRoom.noApp', { context: roomType })}</Text>
        </View>
      </ScrollView>
    </Atmosphere>
  )
}
