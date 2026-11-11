import { useOnlineStatus } from '@/shared/api/queries/use-online-status'
import { OfflineState } from '@/shared/ui/async-state.view'
import { useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { AppState, Pressable, View } from 'react-native'
import { useMyRooms } from '@/shared/api'
import { GhostBtn } from '@/shared/ui/primitives'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { RoomMemberSkeleton } from '@/shared/ui/skeleton.view'
import { UPCOMING } from './room-status'
import { nearestUpcomingRoom } from './profile-upcoming'
import { styles } from './profile.style'

export function ProfileUpcoming({ enabled }: { enabled: boolean }) {
  const online = useOnlineStatus()
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const rooms = useMyRooms({ status: UPCOMING.join(','), enabled })
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    const sub = AppState.addEventListener('change', state => { if (state === 'active') setNow(Date.now()) })
    return () => { clearInterval(timer); sub.remove() }
  }, [])
  const { hasNextPage, isFetching, isError, fetchNextPage } = rooms
  useEffect(() => {
    if (enabled && hasNextPage && !isFetching && !isError) void fetchNextPage()
  }, [enabled, hasNextPage, isFetching, isError, fetchNextPage])
  if (!enabled) return null
  if (!online && (rooms.isPending || rooms.hasNextPage)) return <OfflineState />
  if (rooms.isError) return <View style={styles.banner}><Text variant="bodySmall" color="text.secondary">{t('g11.upcomingFailed')}</Text><GhostBtn label={t('common.retry')} onPress={() => void (rooms.isFetchNextPageError ? rooms.fetchNextPage() : rooms.refetch())} /></View>
  if (rooms.isPending) return <View testID="profile-upcoming-loading" accessibilityRole="progressbar" accessibilityLabel={t('common.loading')} style={styles.banner}><View style={styles.identityText}><RoomMemberSkeleton count={1} /></View></View>
  if (rooms.hasNextPage) return <Text variant="bodySmall" color="text.secondary" style={styles.banner}>{t('common.loading')}</Text>
  const room = nearestUpcomingRoom(rooms.data?.pages.flatMap(page => page.items) ?? [], now)
  if (!room) return null
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(room.startAt ?? room.scheduledDate!))
  return <Pressable testID="profile-upcoming" accessibilityRole="button" onPress={() => router.push(room.planId && ['ready', 'active'].includes(room.status) ? `/plans/${room.planId}` : `/room/${room.id}`)} style={({ pressed }) => [styles.banner, pressed && styles.settingRowPressed]}>
    <View style={styles.bannerIcon}><Icon name="sparkle" size={18} color="accent.onAccent" /></View>
    <View style={styles.identityText}><Text variant="label">{t('g11.upcoming')}</Text>{room.title ? <Text variant="introCaption" numberOfLines={2}>{room.title}</Text> : null}<Text variant="caption" color="text.secondary">{date}</Text></View>
    <Icon name="chevronRight" color="status.infoText" />
  </Pressable>
}
