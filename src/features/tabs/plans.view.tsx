import { useQueries } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getRoom, queryKeys, type RoomSummary } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { useRecentRoomsStore } from '@/shared/store/recentRoomsStore'
import { EmptyState } from '@/shared/ui/async-state.view'
import { Atmosphere, GhostBtn, GlassCard, TagChip, useTabDockInset } from '@/shared/ui/primitives'
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

  function roomMeta(room: RoomSummary): string {
    return [
      t(`plans.status.${room.status}`, { defaultValue: room.status }),
      room.type === 'group' ? t('groupSetup.people', { n: room.participantCount }) : null,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top + spacing[2] }}>
        <Text style={styles.title}>{t('plans.title')}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: dockInset }}>
        {recent.length === 0 ? (
          <EmptyState
            title={t('plans.emptyTitle')}
            body={status === 'anonymous' ? t('plans.emptySignedOut') : t('plans.emptyBody')}
            action={<GhostBtn label={t('home.createDate')} onPress={() => router.push('/create/type')} />}
          />
        ) : null}

        {upcoming.length > 0 ? (
          <>
            <Text style={styles.caption}>{t('plans.upcoming')}</Text>
            {upcoming.map(room => (
              <Pressable key={room.id} onPress={() => openRoom(room)}>
                <GlassCard style={styles.upcomingCard}>
                  <View style={styles.upcomingIcon}>
                    <Text style={{ fontSize: 24 }}>{room.type === 'group' ? '👥' : '💞'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.upcomingTitle}>{room.title ?? t('plans.untitled')}</Text>
                    <Text style={styles.upcomingMeta}>{roomMeta(room)}</Text>
                  </View>
                  {room.status === 'ready' || room.status === 'active' ? (
                    <TagChip label={t('datePlan.match')} color="green" />
                  ) : null}
                </GlassCard>
              </Pressable>
            ))}
          </>
        ) : null}

        {past.length > 0 ? (
          <>
            <Text style={styles.caption}>{t('plans.past')}</Text>
            {past.map(room => (
              <Pressable key={room.id} onPress={() => openRoom(room)}>
                <GlassCard style={styles.upcomingCard}>
                  <View style={styles.upcomingIcon}>
                    <Text style={{ fontSize: 24 }}>{room.type === 'group' ? '👥' : '💞'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.upcomingTitle}>{room.title ?? t('plans.untitled')}</Text>
                    <Text style={styles.upcomingMeta}>{roomMeta(room)}</Text>
                  </View>
                </GlassCard>
              </Pressable>
            ))}
          </>
        ) : null}

        {/* Being straight about why the list may look short. */}
        {recent.length > 0 ? <Text style={styles.deviceOnlyNote}>{t('plans.deviceOnly')}</Text> : null}
      </ScrollView>
    </Atmosphere>
  )
}
