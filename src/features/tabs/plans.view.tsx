import { useQueries } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getRoom, queryKeys, type RoomSummary } from '@/shared/api'
import { formatMoney } from '@/shared/pricing/money'
import { useSession } from '@/shared/providers/session-provider'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { EmptyState } from '@/shared/ui/async-state.view'
import { Atmosphere, Chip, GhostBtn, GlassCard, SecondaryBtn, useTabDockInset } from '@/shared/ui/primitives'
import { RoomMemberSkeleton } from '@/shared/ui/skeleton.view'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './plans.style'

/** Statuses that still have something ahead of them. */
const UPCOMING: readonly RoomSummary['status'][] = ['draft', 'collecting', 'matching', 'ready', 'active']

export default function PlansScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const dockInset = useTabDockInset()
  const { status } = useSession()

  const recent = useRecentRoomsStore(state => state.rooms)

  /**
   * The contract has no `GET /rooms` (GoGo-BE#152), so this can only show rooms
   * opened on this device. Each is refetched for its live status — the stored
   * copy goes stale the moment anyone else changes the room.
   */
  const rooms = useQueries({
    queries: recent.map(entry => ({
      queryKey: queryKeys.room(entry.roomId),
      queryFn: () => getRoom(entry.roomId),
      // A room the actor was removed from now 403s; do not hammer it.
      retry: false,
    })),
  })

  const loaded = useMemo(
    () => rooms.flatMap(query => (query.data ? [query.data] : [])),
    [rooms],
  )
  const upcoming = loaded.filter(room => UPCOMING.includes(room.status))
  const past = loaded.filter(room => !UPCOMING.includes(room.status))

  function openRoom(room: RoomSummary) {
    router.push(`/room/${room.id}`)
  }

  /**
   * Room facts, composed here — the DTO carries `type`, `participantCount` and
   * `constraints`, never a written sentence (RULE-API-DTO).
   */
  function roomFacts(room: RoomSummary): string[] {
    const constraints = room.constraints
    const budget = constraints?.budgetAmount
      ? `${formatMoney(constraints.budgetAmount, constraints.currency ?? 'VND')} ${
          constraints.budgetMode === 'per_person' ? t('datePlan.perPerson') : t('price.groupTotal')
        }`
      : null
    return [
      room.type === 'group' ? t('groupSetup.people', { n: room.participantCount }) : t('datePlan.for2'),
      budget,
    ].filter((fact): fact is string => Boolean(fact))
  }

  /** Status is the one fact that decides whether a room still needs the user. */
  function statusVariant(status: RoomSummary['status']): 'default' | 'info' | 'positive' | 'warning' {
    if (status === 'ready' || status === 'active') return 'positive'
    if (status === 'collecting' || status === 'matching') return 'info'
    if (status === 'cancelled' || status === 'expired') return 'warning'
    return 'default'
  }

  function RoomCard({ room, past = false }: { room: RoomSummary; past?: boolean }) {
    return (
      <Pressable accessibilityRole="button" onPress={() => openRoom(room)}>
        <GlassCard style={[styles.card, past && styles.cardPast]}>
          <View style={[styles.icon, past && styles.iconPast]}>
            <Text style={{ fontSize: 24 }}>{room.type === 'group' ? '👥' : '💞'}</Text>
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

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top + spacing[2] }}>
        <Text style={styles.title}>{t('plans.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: dockInset }}>
        {/* Rooms are refetched for their live status; until they land there is
            a known number of rows coming, so show that many. */}
        {recent.length > 0 && loaded.length === 0 && rooms.some(query => query.isPending) ? (
          <View style={{ paddingTop: spacing[4] }}>
            <RoomMemberSkeleton count={Math.min(recent.length, 3)} />
          </View>
        ) : null}

        {recent.length === 0 ? (
          <EmptyState
            title={t('plans.emptyTitle')}
            body={status === 'anonymous' ? t('plans.emptySignedOut') : t('plans.emptyBody')}
            action={
              <View style={{ gap: spacing[2], alignSelf: 'stretch' }}>
                <SecondaryBtn label={t('home.createDate')} onPress={() => router.push('/create/type')} />
                <GhostBtn label={t('joinByCode.title')} onPress={() => router.push('/join')} />
              </View>
            }
          />
        ) : null}

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

        {/* Being straight about why the list may look short. */}
        {recent.length > 0 ? <Text style={styles.deviceOnlyNote}>{t('plans.deviceOnly')}</Text> : null}
      </ScrollView>
    </Atmosphere>
  )
}
