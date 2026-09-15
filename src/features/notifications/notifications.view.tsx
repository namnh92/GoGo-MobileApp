import { useRouter } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getCurrentPlan, parseApiDate, useMarkNotificationRead, useNotifications, type Notification } from '@/shared/api'
import { isUuid } from '@/shared/navigation/deep-link'
import { PLAN_UNAVAILABLE_NOTICE } from '@/shared/navigation/room-steps'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { Atmosphere, BackHeader, GhostBtn, GlassCard } from '@/shared/ui/primitives'
import { spacing } from '@/shared/ui/tokens'

import { styles } from './notifications.style'

/** Where each notification kind should take the reader. */
function routeFor(notification: Notification): string | null {
  const payload = (notification.payload ?? {}) as Record<string, unknown>
  // A payload is data from outside this build; an id that is not a UUID would
  // build a route every read on the next screen answers with 400 (#203).
  const roomId = isUuid(payload.roomId) ? payload.roomId : null
  const planId = isUuid(payload.planId) ? payload.planId : null

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

const PLAN_KINDS: ReadonlySet<string> = new Set(['plan_ready', 'plan_changed', 'date_reminder'])

/**
 * GoGo-MobileApp#198 — a plan notification that names only its room (every one
 * DEV sends: `{ eventType, roomId, resourceId }`) opens the room's current plan,
 * as a tapped push does (#256), instead of the lobby. With no plan to open it
 * still opens the room, and the room says why.
 */
async function resolveRoute(notification: Notification): Promise<string | null> {
  const payload = (notification.payload ?? {}) as Record<string, unknown>
  const roomId = isUuid(payload.roomId) ? payload.roomId : null
  if (!roomId || isUuid(payload.planId) || !PLAN_KINDS.has(notification.kind ?? '')) return routeFor(notification)
  try {
    const plan = await getCurrentPlan(roomId)
    if (isUuid(plan?.id)) return `/plans/${plan.id}`
  } catch {
    // No current plan, or it could not be read right now: the room is the way in.
  }
  return `/room/${roomId}?notice=${PLAN_UNAVAILABLE_NOTICE}`
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

  // Resolving a plan is a request: one row at a time, and the row says it is busy.
  const opening = useRef(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  async function open(notification: Notification) {
    if (opening.current) return
    opening.current = true
    setOpeningId(notification.id ?? null)
    if (notification.id && !notification.readAt) markRead.mutate(notification.id)
    try {
      const route = await resolveRoute(notification)
      if (route) router.push(route)
    } finally {
      opening.current = false
      setOpeningId(null)
    }
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
          const busy = openingId !== null && openingId === item.id
          return (
            <Pressable
              onPress={() => void open(item)}
              accessibilityRole="button"
              accessibilityState={{ busy }}
            >
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
                {busy ? <ActivityIndicator /> : null}
              </GlassCard>
            </Pressable>
          )
        }}
      />
    </Atmosphere>
  )
}
