import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessibilityInfo, ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { parseApiDate, useMarkNotificationRead, useNotifications, type Notification } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { Atmosphere, BackHeader, GhostBtn, GlassCard } from '@/shared/ui/primitives'
import { spacing } from '@/shared/ui/tokens'

import { resolveInboxTarget } from './inbox-target'
import { styles } from './notifications.style'

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

  // Where a row opens is a request away (#198, see inbox-target.ts). The latest
  // tap wins, the row being resolved says so, and nothing opens once the
  // person has left the inbox. Leaving by Back unmounts it before a state
  // update could commit, so the focus callback sets a ref itself.
  const onScreen = useRef(true)
  useFocusEffect(
    useCallback(() => {
      onScreen.current = true
      return () => {
        onScreen.current = false
      }
    }, []),
  )
  const latestTap = useRef(0)
  const openingNow = useRef<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [openProblem, setOpenProblem] = useState<'refused' | 'retry' | null>(null)

  async function open(notification: Notification) {
    const id = notification.id ?? null
    // The same row again while it resolves is the same intent, not a new one.
    if (id !== null && openingNow.current === id) return
    if (id && !notification.readAt) markRead.mutate(id)
    const tap = ++latestTap.current
    openingNow.current = id
    setOpeningId(id)
    setOpenProblem(null)
    const decision = await resolveInboxTarget(notification)
    if (tap !== latestTap.current) return
    openingNow.current = null
    setOpeningId(null)
    if (!onScreen.current) return
    if (decision.to === 'open') router.push(decision.path)
    else if (decision.to === 'refused' || decision.to === 'retry') setOpenProblem(decision.to)
  }

  useEffect(() => {
    if (!openProblem) return
    // The live region below is Android-only; VoiceOver needs the announcement.
    AccessibilityInfo.announceForAccessibility(
      openProblem === 'retry' ? t('notifications.openRetry') : t('notifications.openRefused'),
    )
  }, [openProblem, t])

  const header = (
    <View style={{ paddingTop: insets.top }}>
      <BackHeader onBack={() => router.back()} title={t('notifications.title')} />
      {openProblem ? (
        <Text accessibilityLiveRegion="polite" style={styles.openProblem}>
          {openProblem === 'retry' ? t('notifications.openRetry') : t('notifications.openRefused')}
        </Text>
      ) : null}
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
