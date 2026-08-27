import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { parseApiDate, useMarkNotificationRead, useNotifications, type Notification } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { Atmosphere, BackHeader, GhostBtn, GlassCard } from '@/shared/ui/primitives'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './notifications.style'

/** Where each notification kind should take the reader. */
function routeFor(notification: Notification): string | null {
  const payload = (notification.payload ?? {}) as Record<string, unknown>
  const roomId = typeof payload.roomId === 'string' ? payload.roomId : null
  const planId = typeof payload.planId === 'string' ? payload.planId : null

  switch (notification.kind) {
    case 'invite':
    case 'preference_reminder':
      return roomId ? `/room/${roomId}` : null
    case 'plan_ready':
    case 'plan_changed':
    case 'date_reminder':
      return planId ? `/plans/${planId}` : roomId ? `/room/${roomId}` : null
    default:
      return null
  }
}

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { status } = useSession()

  // Guests get 403 USER_ONLY on the inbox.
  const canRead = status === 'user'
  const inbox = useNotifications({ enabled: canRead })
  const markRead = useMarkNotificationRead()

  const items = useMemo(
    () => (inbox.data?.pages ?? []).flatMap(page => page.notifications ?? []),
    [inbox.data],
  )

  function open(notification: Notification) {
    if (notification.id && !notification.readAt) markRead.mutate(notification.id)
    const route = routeFor(notification)
    if (route) router.push(route)
  }

  const header = (
    <View style={{ paddingTop: insets.top }}>
      <BackHeader onBack={() => router.back()} title={t('notifications.title')} />
    </View>
  )

  if (!canRead) {
    return (
      <Atmosphere>
        {header}
        <EmptyState
          title={t('notifications.signInTitle')}
          body={t('notifications.signInBody')}
          action={<GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />}
        />
      </Atmosphere>
    )
  }

  if (inbox.isPending) {
    return (
      <Atmosphere>
        {header}
        <LoadingState />
      </Atmosphere>
    )
  }

  if (inbox.isError) {
    return (
      <Atmosphere>
        {header}
        <ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} />
      </Atmosphere>
    )
  }

  return (
    <Atmosphere>
      {header}
      <FlatList
        data={items}
        keyExtractor={item => item.id ?? String(item.createdAt)}
        contentContainerStyle={{ paddingHorizontal: spacing[5], paddingBottom: insets.bottom + spacing[6] }}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (inbox.hasNextPage && !inbox.isFetchingNextPage) void inbox.fetchNextPage()
        }}
        ListEmptyComponent={
          <EmptyState title={t('notifications.emptyTitle')} body={t('notifications.emptyBody')} />
        }
        ListFooterComponent={
          inbox.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: spacing[4] }} /> : null
        }
        renderItem={({ item }) => {
          const unread = !item.readAt
          const created = parseApiDate(item.createdAt)
          return (
            <Pressable onPress={() => open(item)} accessibilityRole="button">
              <GlassCard style={[styles.row, unread && styles.rowUnread]}>
                {/* Unread is marked by more than colour (RULE-DS-COLOR). */}
                <View style={styles.dotColumn}>
                  {unread ? <View style={styles.unreadDot} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.kind, unread && styles.kindUnread]}>
                    {t(`notifications.kind.${item.kind}`, { defaultValue: item.kind ?? '' })}
                  </Text>
                  {created ? (
                    <Text style={styles.time}>{created.toLocaleString(i18n.language)}</Text>
                  ) : null}
                </View>
              </GlassCard>
            </Pressable>
          )
        }}
      />
    </Atmosphere>
  )
}
