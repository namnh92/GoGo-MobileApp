import { useRouter } from 'expo-router'
import { useMemo } from 'react'
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
  const rooms = useMyRooms({ enabled: canRead })

  // Kept only as an offline read: the server list is the source of truth, but a
  // launch with no connection should still show what this device has seen.
  const recent = useRecentRoomsStore(state => state.rooms)

  const items = useMemo(
    () => (rooms.data?.pages ?? []).flatMap(page => page.items),
    [rooms.data],
  )
  const upcoming = items.filter(room => UPCOMING.includes(room.status))
  const past = items.filter(room => !UPCOMING.includes(room.status))

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
    ].filter((fact): fact is string => Boolean(fact))
  }

  /** Status is the one fact that decides whether a room still needs the user. */
  function statusVariant(s: RoomListItem['status']): 'default' | 'info' | 'positive' | 'warning' {
    if (s === 'ready' || s === 'active') return 'positive'
    if (s === 'collecting' || s === 'matching') return 'info'
    if (s === 'cancelled' || s === 'expired') return 'warning'
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
            variant={statusVariant(room.status)}
          />
        </GlassCard>
      </Pressable>
    )
  }

  const isEmpty = !rooms.isPending && items.length === 0

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top + spacing[2] }}>
        <Text style={styles.title}>{t('plans.title')}</Text>
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
            body={t('plans.emptyBody')}
            action={
              <View style={{ gap: spacing[2], alignSelf: 'stretch' }}>
                <SecondaryBtn label={t('home.createDate')} onPress={() => router.push('/create/type')} />
                <GhostBtn label={t('joinByCode.title')} onPress={() => router.push('/join')} />
              </View>
            }
          />
        ) : (
          <>
            {upcoming.length > 0 ? (
              <>
                <Text style={styles.caption}>{t('plans.upcoming')}</Text>
                {upcoming.map(room => (
                  <RoomCard key={room.id} room={room} />
                ))}
              </>
            ) : null}

            {past.length > 0 ? (
              <>
                <Text style={styles.caption}>{t('plans.past')}</Text>
                {past.map(room => (
                  <RoomCard key={room.id} room={room} past />
                ))}
              </>
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
