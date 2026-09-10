import { DraftResume } from '@/features/create-date/draft-resume.view'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { parseApiDate, useMyRooms, type RoomListItem } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { EmptyState, ErrorState, StaleNotice } from '@/shared/ui/async-state.view'
import { Atmosphere, Chip, GhostBtn, GlassCard, SecondaryBtn, useTabDockInset } from '@/shared/ui/primitives'
import { RoomMemberSkeleton } from '@/shared/ui/skeleton.view'
import { glyph, spacing } from '@/shared/ui/tokens'

import { styles } from './plans.style'

/** Statuses that still have something ahead of them. */
const UPCOMING: readonly RoomListItem['status'][] = ['draft', 'collecting', 'matching', 'ready', 'active']

export default function PlansScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const dockInset = useTabDockInset()
  const { status } = useSession()

  const canRead = status === 'user' || status === 'guest'
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming')
  const rooms = useMyRooms({ enabled: canRead, status: tab === 'upcoming' ? UPCOMING.join(',') : 'completed,cancelled,expired' })

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
    // A finished room's plan is the thing worth reopening; an active one is not.
    if (!UPCOMING.includes(room.status) && room.planId) {
      router.push(`/plans/${room.planId}`)
      return
    }
    router.push(`/room/${room.id}`)
  }

  /**
   * Room facts, composed here — the DTO carries `type`, `participantCount` and
   * the progress counts, never a written sentence (RULE-API-DTO).
   */
  function roomFacts(room: RoomListItem): string[] {
    const scheduled = parseApiDate(room.scheduledDate)
    return [
      room.type === 'group'
        ? t('groupSetup.people', { n: room.participantCount })
        : t('datePlan.for2'),
      room.completedCount != null && room.memberCount != null
        ? t('gogoRoom.membersTitle', { joined: room.completedCount, total: room.memberCount })
        : null,
      scheduled ? scheduled.toLocaleDateString(i18n.language) : null,
      isOverdue(room) ? t('plans.overdue') : null,
    ].filter((fact): fact is string => Boolean(fact))
  }

  /**
   * A room whose date has passed but whose lifecycle has not ended stays in
   * Upcoming (the server filters by status, never by date) — it just says so.
   */
  function isOverdue(room: RoomListItem): boolean {
    const scheduled = parseApiDate(room.scheduledDate)
    return UPCOMING.includes(room.status) && scheduled != null && scheduled.getTime() < Date.now()
  }

  /** Status is the one fact that decides whether a room still needs the user. */
  function statusVariant(room: RoomListItem): 'default' | 'info' | 'positive' | 'warning' {
    const s = room.status
    if (s === 'cancelled' || s === 'expired' || isOverdue(room)) return 'warning'
    if (s === 'ready' || s === 'active') return 'positive'
    if (s === 'collecting' || s === 'matching') return 'info'
    return 'default'
  }

  function RoomCard({ room, past: isPast = false }: { room: RoomListItem; past?: boolean }) {
    return (
      <Pressable accessibilityRole="button" onPress={() => openRoom(room)}>
        <GlassCard style={[styles.card, isPast && styles.cardPast]}>
          <View style={[styles.icon, isPast && styles.iconPast]}>
            <Text style={{ fontSize: glyph.sm }}>{room.type === 'group' ? '👥' : '💞'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {room.title ?? t('plans.untitled')}
            </Text>
            <View style={styles.cardFacts}>
              {roomFacts(room).map((fact, index) => (
                <Text key={fact} style={styles.fact}>
                  {index > 0 ? '· ' : ''}
                  {fact}
                </Text>
              ))}
            </View>
          </View>
          <Chip
            label={t(`plans.status.${room.status}`, { defaultValue: room.status })}
            variant={statusVariant(room)}
          />
        </GlassCard>
      </Pressable>
    )
  }

  const isEmpty = !rooms.isPending && visible.length === 0 && !rooms.hasNextPage

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top + spacing[2] }}>
        <Text style={styles.title}>{t('plans.title')}</Text>
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
            <Text style={[styles.tabLabel, tab === value && styles.tabLabelSelected]}>
              {t(value === 'upcoming' ? 'plans.upcoming' : 'plans.past')}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* A failed refetch keeps the list that is already on screen. */}
      <StaleNotice
        error={rooms.isError && items.length > 0 ? rooms.error : null}
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
            {visible.map(room => <RoomCard key={room.id} room={room} past={tab === 'history'} />)}
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
