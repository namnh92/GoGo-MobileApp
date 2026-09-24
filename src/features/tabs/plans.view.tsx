import { DraftResume } from '@/features/create-date/draft-resume.view'
import { roomScheduleLabel } from '@/features/gogo-room/room-schedule'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { parseApiDate, useMyRooms, type RoomListItem } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { useWaitingForNetwork } from '@/shared/api/queries/use-online-status'
import { useFocusedNow } from '@/shared/hooks/use-focused-now'
import { EmptyState, ErrorState, OfflineState, StaleNotice } from '@/shared/ui/async-state.view'
import { PlanCard } from '@/shared/ui/plan-card.view'
import { Atmosphere, GhostBtn, SecondaryBtn, useTabDockInset } from '@/shared/ui/primitives'
import { RoomMemberSkeleton } from '@/shared/ui/skeleton.view'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './plans.style'

/** Statuses that still have something ahead of them. */
const UPCOMING: readonly RoomListItem['status'][] = ['draft', 'collecting', 'matching', 'ready', 'active']
/** Still deciding: such a room opens on its lobby, anything later on its plan (#198). */
const DECIDING: readonly RoomListItem['status'][] = ['draft', 'collecting', 'matching']

export default function PlansScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const dockInset = useTabDockInset()
  const { status } = useSession()
  const now = useFocusedNow()

  const canRead = status === 'user' || status === 'guest'
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming')
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
   * Room facts, composed here — the DTO carries `type`, `participantCount` and
   * the progress counts, never a written sentence (RULE-API-DTO).
   */
  function roomFacts(room: RoomListItem): string[] {
    const scheduled = roomScheduleLabel(room.scheduledDate, i18n.language)
    return [
      room.type === 'group'
        ? t('groupSetup.people', { n: room.participantCount })
        : t('datePlan.for2'),
      room.completedCount != null && room.memberCount != null
        ? t('gogoRoom.membersTitle', { joined: room.completedCount, total: room.memberCount })
        : null,
      scheduled ?? t('roomSchedule.unset'),
      isOverdue(room) ? t('plans.overdue') : null,
    ].filter((fact): fact is string => Boolean(fact))
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
      <View style={{ paddingTop: insets.top + spacing[2] }}>
        <Text variant="display" style={styles.title}>{t('plans.title')}</Text>
        {status === 'user' ? (
          <View style={styles.createAction}>
            <SecondaryBtn label={t('home.createDate')} onPress={() => router.push('/create/type')} />
          </View>
        ) : null}
      </View>

      <View style={styles.createAction}>
        <DraftResume />
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {(['upcoming', 'history'] as const).map(value => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            onPress={() => setTab(value)}
            style={[styles.tab, tab === value && styles.tabSelected]}
          >
            {/* Weight changes with the fill, so selection is never colour alone. */}
            <Text variant={tab === value ? 'label' : 'bodySmall'} color={tab === value ? 'accent.onSoft' : 'text.primary'}>
              {t(value === 'upcoming' ? 'plans.upcoming' : 'plans.past')}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* A failed refetch keeps the list that is already on screen. */}
      <StaleNotice
        error={rooms.isError ? rooms.error : null}
        hasData={visible.length > 0}
        onRetry={() => void rooms.refetch()}
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: dockInset }}>
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
            action={
              <View style={{ gap: spacing[2], alignSelf: 'stretch' }}>
                <SecondaryBtn label={t('home.createDate')} onPress={() => router.push('/create/type')} />
                <GhostBtn label={t('joinByCode.title')} onPress={() => router.push('/join')} />
              </View>
            }
          />
        ) : (
          <>
            {visible.map(room => (
              <PlanCard
                key={room.id}
                testID={`plan-card-${room.id}`}
                icon={room.type === 'group' ? '👥' : '💞'}
                title={room.title ?? t('plans.untitled')}
                meta={roomFacts(room).join(' · ')}
                status={{
                  label: t(`plans.status.${room.status}`, { defaultValue: room.status }),
                  variant: statusVariant(room),
                }}
                past={tab === 'history'}
                onPress={() => openRoom(room)}
                style={styles.card}
              />
            ))}
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
