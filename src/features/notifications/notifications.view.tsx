import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessibilityInfo, ActivityIndicator, FlatList, Platform, Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { parseApiDate, useMarkNotificationRead, useNotifications, useRoom, type Notification } from '@/shared/api'
import { SessionCancelledError } from '@/shared/api/session'
import { isUuid } from '@/shared/navigation/deep-link'
import { PUSH_UNAVAILABLE_NOTICE } from '@/shared/notifications/notification-target'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/async-state.view'
import { Icon } from '@/shared/ui/icons'
import { Atmosphere, BackHeader, Card, GhostBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { resolveInboxTarget } from './inbox-target'
import { kindPresentation } from './notification-kind'
import { styles } from './notifications.style'
import { goBackOrHome } from '@/shared/navigation/go-back-or-home'

/**
 * Only the first rows ask for their room's name, so a long inbox cannot fire a
 * request per row. Rows share one query per room id, and a failed or missing
 * read omits the line: it never blocks or breaks the list.
 */
const ROOM_NAME_ROWS = 5

function RoomLine({ roomId }: { roomId: string }) {
  const { t } = useTranslation()
  const name = useRoom(roomId).data?.title
  if (!name) return null
  return (
    <Text variant="bodySmall" color="text.secondary" numberOfLines={1} style={styles.roomLine}>
      {t('notifications.room', { name })}
    </Text>
  )
}

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { status } = useSession()
  // GoGo-MobileApp#256 — a tapped push that could not be opened lands here.
  const { notice } = useLocalSearchParams<{ notice?: string }>()
  const pushUnavailable = notice === PUSH_UNAVAILABLE_NOTICE
  // `accessibilityLiveRegion` below is Android-only; VoiceOver needs an
  // announcement to hear why the inbox opened instead. Queued on iOS, so the
  // screen change VoiceOver is still speaking does not cut it off.
  useEffect(() => {
    if (!pushUnavailable) return
    const message = t('notifications.pushUnavailable')
    if (Platform.OS === 'ios' && typeof AccessibilityInfo.announceForAccessibilityWithOptions === 'function') {
      AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true })
    } else {
      AccessibilityInfo.announceForAccessibility(message)
    }
  }, [pushUnavailable, t])

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
    let decision
    try {
      decision = await resolveInboxTarget(notification)
    } catch (error) {
      if (!(error instanceof SessionCancelledError)) throw error
      return
    } finally {
      if (tap === latestTap.current) {
        openingNow.current = null
        setOpeningId(null)
      }
    }
    if (tap !== latestTap.current) return
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
      <BackHeader onBack={() => goBackOrHome(router)} title={t('notifications.title')} />
      {pushUnavailable ? (
        <Text variant="bodySmall" accessibilityLiveRegion="polite" style={styles.notice}>
          {t('notifications.pushUnavailable')}
        </Text>
      ) : null}
      {openProblem ? (
        <Text variant="bodySmall" accessibilityLiveRegion="polite" style={styles.openProblem}>
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
        renderItem={({ item, index }) => {
          const unread = !item.readAt
          const created = parseApiDate(item.createdAt)
          const busy = openingId !== null && openingId === item.id
          const kindLabel = t(`notifications.kind.${item.kind}`, { defaultValue: item.kind ?? '' })
          const { icon, body } = kindPresentation(item.kind)
          const payloadRoomId = (item.payload as Record<string, unknown> | undefined)?.roomId
          const roomId = index < ROOM_NAME_ROWS && isUuid(payloadRoomId) ? payloadRoomId : null
          return (
            <Pressable
              onPress={() => void open(item)}
              accessibilityRole="button"
              // #271: a busy control needs a label, or Android keeps saying "busy".
              accessibilityLabel={[kindLabel, body ? t(body) : null, created ? created.toLocaleString(i18n.language) : null].filter(Boolean).join(', ')}
              accessibilityState={{ busy }}
            >
              <Card padded={false} style={[styles.row, unread && styles.rowUnread]}>
                {/* Unread is marked by more than colour (RULE-DS-COLOR). */}
                <View style={[styles.iconTile, unread && styles.iconTileUnread]}>
                  <Icon name={icon} size={20} color={unread ? 'accent.onSoft' : 'text.secondary'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant={unread ? 'title2' : 'body'}>{kindLabel}</Text>
                  {body ? <Text variant="bodySmall" style={styles.body}>{t(body)}</Text> : null}
                  {roomId ? <RoomLine roomId={roomId} /> : null}
                  {/* TODO(https://github.com/namnh92/GoGo-BE/issues/753): inviter name, progress, stop count, change details, campaign text and the draft's "Để sau" action need data the API does not give. */}
                  {created ? (
                    <Text variant="caption" color="text.secondary" style={styles.time}>{created.toLocaleString(i18n.language)}</Text>
                  ) : null}
                </View>
                {busy ? <ActivityIndicator /> : null}
                <View style={styles.dotColumn}>
                  {unread ? <View style={styles.unreadDot} /> : null}
                </View>
              </Card>
            </Pressable>
          )
        }}
      />
    </Atmosphere>
  )
}
