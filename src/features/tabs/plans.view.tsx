import { AppHeader } from '@/shared/ui/app-header.view'
import { useAssistantFabScroll } from '@/features/assistant/assistant-entry'
import { DraftResume } from '@/features/create-date/draft-resume.view'
import { roomScheduleLabel } from '@/features/gogo-room/room-schedule'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, View } from 'react-native'

import { parseApiDate, useMyRooms, type RoomListItem } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { useFocusedNow } from '@/shared/hooks/use-focused-now'
import { budgetFact } from '@/shared/pricing/budget-unit'
import { EmptyState, ErrorState, OfflineState, StaleNotice } from '@/shared/ui/async-state.view'
import { FilledSegmentedControl } from '@/shared/ui/filled-segmented-control.view'
import { PlanCard } from '@/shared/ui/plan-card.view'
import { Atmosphere, GhostBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { RoomMemberSkeleton } from '@/shared/ui/skeleton.view'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './plans.style'
import { UPCOMING } from './upcoming-rooms'

/** Statuses that still have something ahead of them. */
/** Still deciding: such a room opens on its lobby, anything later on its plan (#198). */
const DECIDING: readonly RoomListItem['status'][] = ['draft', 'collecting', 'matching']

export default function PlansScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  // The float button (#379) collapses on scroll; the list's end clears it.
  const fab = useAssistantFabScroll('plans')
  const { status } = useSession()
  const now = useFocusedNow()

  const canRead = status === 'user' || status === 'guest'
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming')
  // Set by the Cá nhân "Kèo" shortcut to a new value on every press (#471).
  // This tab stays mounted, so the change is the signal; opening it from the
  // tab bar sends nothing and keeps the person's last choice.
  const { showUpcoming } = useLocalSearchParams<{ showUpcoming?: string }>()
  const [handled, setHandled] = useState(showUpcoming)
  if (showUpcoming !== handled) {
    setHandled(showUpcoming)
    if (showUpcoming) setTab('upcoming')
  }
  const rooms = useMyRooms({ enabled: canRead, status: tab === 'upcoming' ? UPCOMING.join(',') : 'completed,cancelled,expired' })
  const waitingForNetwork = useWaitingForNetwork(rooms)

  // Kept only as an offline read: the server list is the source of truth, but a
  // launch with no connection should still show what this device has seen.
  const recent = useRecentRoomsStore(state => state.rooms)

  const items = useMemo(
    () => (rooms.data?.pages ?? []).flatMap(page => page.items),
    [rooms.data],
  )
  const upcoming = items.filter(room => UPCOMING.includes(room.status))
  const past = items.filter(room => !UPCOMING.includes(room.status))
  const visible = tab === 'upcoming' ? upcoming : past

  function openRoom(room: RoomListItem) {
    // A room with a plan — ready, active or finished — reopens that plan. The
    // lobby is for a room still deciding (#198: a ready room used to open it).
    if (room.planId && !DECIDING.includes(room.status)) {
      router.push(`/plans/${room.planId}`)
      return
    }
    // A card with no plan id still gets there: the lobby resolves the room's
    // current plan and opens it.
    router.push(`/room/${room.id}`)
  }

  /**
   * Room facts, composed here — the DTO carries `type`, `participantCount`,
   * the progress counts and the budget facts, never a written sentence
   * (RULE-API-DTO). Each fact also has the sentence a screen reader says; the
   * budget sits right after the people count (#293 §3, GoGo-BE#637).
   */
  function roomFacts(room: RoomListItem): { text: string; spoken: string }[] {
    const scheduled = roomScheduleLabel(room.scheduledDate, i18n.language)
    const plain = (text: string | null) => (text ? { text, spoken: text } : null)
    return [
      plain(room.type === 'group'
        ? t('groupSetup.people', { n: room.participantCount })
        : t('datePlan.for2')),
      budgetFact(room.budget, room.participantCount, t),
      plain(room.completedCount != null && room.memberCount != null
        ? t('gogoRoom.membersTitle', { joined: room.completedCount, total: room.memberCount })
        : null),
      plain(scheduled ?? t('roomSchedule.unset')),
      plain(isOverdue(room) ? t('plans.overdue') : null),
    ].filter((fact): fact is { text: string; spoken: string } => fact != null)
  }

  /**
   * A room whose date has passed but whose lifecycle has not ended stays in
   * Upcoming (the server filters by status, never by date) — it just says so.
   *
   * "Now" is taken when the screen comes into focus, not when the list was
   * fetched — a list cached offline must still flag a date that has since passed.
   */
  function isOverdue(room: RoomListItem): boolean {
    const scheduled = parseApiDate(room.scheduledDate)
    return UPCOMING.includes(room.status) && scheduled != null && scheduled.getTime() < now
  }

  /** Status is the one fact that decides whether a room still needs the user. */
  function statusVariant(room: RoomListItem): 'default' | 'info' | 'positive' | 'warning' {
    const s = room.status
    if (s === 'cancelled' || s === 'expired' || isOverdue(room)) return 'warning'
    if (s === 'ready' || s === 'active') return 'positive'
    if (s === 'collecting' || s === 'matching') return 'info'
    return 'default'
  }

  const isEmpty = !rooms.isPending && visible.length === 0 && !rooms.hasNextPage

  return (
    <Atmosphere>
      <View>
        <AppHeader variant="tab-root" title={t('plans.title')} bellTestID="plans-bell" unreadDotTestID="plans-unread" />
        {/* #247: for a user, entering an invite code must not depend on having
            no room yet. Not for a guest (#314 F-01): /join would replace the
            guest session holding their room; confirm-first is #272. */}
        {status === 'user' ? (
          <View style={[styles.createAction, styles.planActions]}>
            <SecondaryBtn label={t('home.createDate')} onPress={() => router.push('/create/type')} icon="plus" />
            <GhostBtn label={t('joinByCode.title')} onPress={() => router.push('/join')} />
          </View>
        ) : null}
      </View>

      <View style={styles.createAction}>
        <DraftResume />
      </View>

      <FilledSegmentedControl value={tab} onChange={setTab} options={[
        { value: 'upcoming', label: t('plans.upcoming') },
        { value: 'history', label: t('plans.past') },
      ]} />

      {/* A failed refetch keeps the list that is already on screen. */}
      <StaleNotice
        error={rooms.isError ? rooms.error : null}
        hasData={visible.length > 0}
        onRetry={() => void rooms.refetch()}
      />

      <ScrollView
        testID="plans-list"
        onScroll={fab.onScroll}
        scrollEventThrottle={fab.scrollEventThrottle}
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: fab.bottomInset }}
      >
        {!canRead ? (
          <EmptyState
            title={t('plans.emptyTitle')}
            body={t('plans.emptySignedOut')}
            action={
              <View style={{ gap: spacing[2], alignSelf: 'stretch' }}>
                <SecondaryBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in?next=plans')} />
                <GhostBtn label={t('joinByCode.title')} onPress={() => router.push('/join')} />
              </View>
            }
          />
        ) : waitingForNetwork ? (
          <OfflineState />
        ) : rooms.isPending ? (
          <View style={{ paddingTop: spacing[4] }}>
            <RoomMemberSkeleton count={Math.max(Math.min(recent.length, 3), 2)} />
          </View>
        ) : rooms.isError && items.length === 0 ? (
          <ErrorState error={rooms.error} onRetry={() => void rooms.refetch()} />
        ) : isEmpty ? (
          <EmptyState
            title={t('plans.emptyTitle')}
            body={t(tab === 'history' ? 'plans.emptyHistory' : 'plans.emptyBody')}
            // A user has the code entry in the header; a guest keeps it here.
            action={
              <View style={{ gap: spacing[2], alignSelf: 'stretch' }}>
                <SecondaryBtn label={t('home.createDate')} onPress={() => router.push('/create/type')} icon="plus" />
                {status === 'guest' ? (
                  <GhostBtn label={t('joinByCode.title')} onPress={() => router.push('/join')} />
                ) : null}
              </View>
            }
          />
        ) : (
          <>
            {visible.map(room => {
              const facts = roomFacts(room)
              return (
                <PlanCard
                  key={room.id}
                  testID={`plan-card-${room.id}`}
                  icon={room.type === 'group' ? 'users' : 'heart'}
                  title={room.title ?? t('plans.untitled')}
                  meta={facts.map(fact => fact.text).join(' · ')}
                  metaAccessibilityLabel={facts.map(fact => fact.spoken).join(', ')}
                  status={{
                    label: t(`plans.status.${room.status}`, { defaultValue: room.status }),
                    variant: statusVariant(room),
                  }}
                  past={tab === 'history'}
                  onPress={() => openRoom(room)}
                  style={styles.card}
                />
              )
            })}
            {rooms.isFetching && visible.length === 0 ? <RoomMemberSkeleton count={2} /> : null}
            {rooms.isFetchNextPageError ? (
              <ErrorState error={rooms.error} onRetry={() => void rooms.fetchNextPage()} />
            ) : null}

            {rooms.hasNextPage ? (
              <GhostBtn
                label={rooms.isFetchingNextPage ? t('common.loading') : t('plans.loadMore')}
                onPress={() => void rooms.fetchNextPage()}
                disabled={rooms.isFetchingNextPage}
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </Atmosphere>
  )
}
