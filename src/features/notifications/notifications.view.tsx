import { AppHeader, AppHeaderAction } from '@/shared/ui/app-header.view'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessibilityInfo, ActivityIndicator, FlatList, Platform, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useMarkNotificationRead, useNotifications, useNotificationSummary, useReadAllNotifications, useSystemNotificationsQuery, type Notification } from '@/shared/api'
import { captureSessionScope, SessionCancelledError } from '@/shared/api/session'
import { PUSH_UNAVAILABLE_NOTICE } from '@/shared/notifications/notification-target'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState, OfflineState, StaleNotice } from '@/shared/ui/async-state.view'
import { Atmosphere, GhostBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Badge } from '@/shared/ui/badge.view'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { resolveInboxTarget } from './inbox-target'
import { NotificationCard } from './notification-card.view'
import { notificationCapabilities } from './notification-capabilities'
import { Chip } from '@/shared/ui/chip.view'
import { Icon } from '@/shared/ui/icons'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { ResultSheet } from '@/shared/ui/result-sheet.view'
import { styles } from './notifications.style'
import { goBackOrHome } from '@/shared/navigation/go-back-or-home'

export default function NotificationsScreen() {
  const { t } = useTranslation()
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
  const systemInbox = useSystemNotificationsQuery()
  const inbox = useNotifications({ enabled: canRead })
  const markRead = useMarkNotificationRead()
  const capabilities = notificationCapabilities()
  const summary = useNotificationSummary({ enabled: canRead && capabilities.summary })
  const readAll = useReadAllNotifications()
  const readingAll = useRef(false)
  const canReadAll = canRead && capabilities.readAll && !!summary.data?.readThroughCursor && !summary.isError && !summary.isPaused
    && summary.data.unreadCount > 0 && !readAll.isPending
  async function markAll() {
    if (!canReadAll || readingAll.current) return
    const scope = captureSessionScope()
    readingAll.current = true
    setReadProblem(null)
    try {
      await readAll.mutateAsync(summary.data!.readThroughCursor)
    } catch (error) {
      if (!(error instanceof SessionCancelledError) && !scope.signal.aborted) setReadProblem('all')
    } finally {
      readingAll.current = false
    }
  }
  const [readProblem, setReadProblem] = useState<'single' | 'all' | null>(null)
  const [readingIds, setReadingIds] = useState<ReadonlySet<string>>(() => new Set())
  const readingNow = useRef(new Set<string>())

  function mark(notification: Notification) {
    const id = notification.id
    if (!id || notification.readAt || readingNow.current.has(id)) return
    readingNow.current.add(id)
    setReadingIds(current => new Set(current).add(id))
    setReadProblem(null)
    void markRead.mutateAsync(id).catch(error => {
      if (!(error instanceof SessionCancelledError)) setReadProblem('single')
    }).finally(() => {
      readingNow.current.delete(id)
      setReadingIds(current => { const next = new Set(current); next.delete(id); return next })
    })
  }

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
    if (id && !notification.readAt) mark(notification)
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
    <View>
      <AppHeader showNotifications={false} onBack={() => goBackOrHome(router)} title={t('notifications.title')}
        rightAction={<AppHeaderAction accessibilityLabel={t('g10.settingsTitle')} onPress={() => router.push('/settings/notifications')}><Icon name="settings" size={24} /></AppHeaderAction>} />
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

  // Keep the same feed frame in every state. Disabled account queries may
  // still contain cached data during a session transition; never render it.
  const listItems = canRead ? items : []
  const emptyIllustration = <View style={styles.emptyHalo}><View style={styles.emptyWash} /><View style={styles.emptyIllustration}>
    <MaterialIcon name="markChatRead" size={44} color="redesign.violetText" />
  </View></View>
  const listState = !canRead ? <View>
    <Text accessibilityRole="header" variant="introHeading" color="redesign.ink" style={styles.sectionTitle}>{t('g10.systemTitle')}</Text>
    {systemInbox.status === 'unsupported' ? <View testID="system-notifications-unsupported" style={styles.empty}>
      <EmptyState appearance="stitch" title={t('g10.systemUnavailableTitle')} body={t('g10.systemUnavailableBody')} illustration={emptyIllustration} />
    </View> : null}
    <View style={styles.personalSection}>
      <Text accessibilityRole="header" variant="introHeading" color="redesign.ink" style={styles.sectionTitle}>{t('g10.personalTitle')}</Text>
      <View style={styles.empty}><EmptyState appearance="stitch"
        title={t('notifications.signInTitle')} body={t('g10.personalSignInBody')}
        action={<GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />} /></View>
    </View>
  </View> : inbox.isPaused && !inbox.data ? <OfflineState />
    : inbox.isPending ? <View testID="notifications-loading" accessibilityRole="progressbar" accessibilityLabel={t('common.loading')}>
      {[0, 1, 2].map(key => <View key={key} style={styles.skeletonRow}><Skeleton width={48} height={48} radius={24} /><View style={styles.content}><Skeleton width="65%" height={14} /><Skeleton width="100%" height={48} /></View></View>)}
    </View> : inbox.isError && !inbox.data ? <View testID="notifications-error" style={styles.empty}>
      <ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} />
    </View> : <View testID="notifications-empty" style={styles.empty}>
      <EmptyState appearance="stitch" title={t('g10.emptyTitle')} body={t('g10.emptyBody')} illustration={emptyIllustration}
        action={<SecondaryBtn size="small" variant="neutralPill" label={t('g10.reload')} loading={inbox.isRefetching} onPress={() => { void inbox.refetch(); void summary.refetch() }} />} />
    </View>

  return (
    <Atmosphere redesign>
      {header}
      <FlatList
        data={listItems}
        keyExtractor={item => item.id ?? String(item.createdAt)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing[6] }]}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (canRead && inbox.hasNextPage && !inbox.isFetchingNextPage) void inbox.fetchNextPage()
        }}
        ListHeaderComponent={<View>
          <StaleNotice hasData={canRead && !!inbox.data} error={inbox.error} onRetry={() => void inbox.refetch()} />
          <View style={styles.toolbar}>
            <View style={styles.toolbarTitle}>
              <Text accessibilityRole="header" variant="introHeading" color="redesign.ink">{t('g10.allNotifications')}</Text>
              {canRead && summary.data ? <Badge appearance="solid" label={t('g10.newCount', { count: summary.data.unreadCount })} /> : null}
            </View>
            <SecondaryBtn size="small" variant="neutralPill" leadingIcon="doneAll" label={t('g10.readAll')} disabled={!canReadAll}
              loading={readAll.isPending} onPress={() => void markAll()} />
          </View>
          {canRead && summary.isPending && !summary.isPaused ? <Skeleton width={80} height={14} /> : null}
          {canRead && summary.isPaused && !summary.data ? <OfflineState /> : null}
          <StaleNotice hasData={canRead && !!summary.data} error={summary.error} onRetry={() => void summary.refetch()} />
          {canRead && summary.isError && !summary.data ? <ErrorState error={summary.error} onRetry={() => void summary.refetch()} /> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <Chip appearance="raised" label={t('g10.filter.all')} variant="selected" />
            <Chip appearance="raised" label={t('g10.filter.invite')} icon="users" disabled={!capabilities.categoryFilter} onPress={() => undefined}
              accessibilityLabel={`${t('g10.filter.invite')}. ${t('g10.filterUnavailable')}`} />
            <Chip appearance="raised" label={t('g10.filter.plan')} icon="map" disabled={!capabilities.categoryFilter} onPress={() => undefined}
              accessibilityLabel={`${t('g10.filter.plan')}. ${t('g10.filterUnavailable')}`} />
            <Chip appearance="raised" label={t('g10.filter.date')} icon="clock" disabled={!capabilities.categoryFilter} onPress={() => undefined}
              accessibilityLabel={`${t('g10.filter.date')}. ${t('g10.filterUnavailable')}`} />
          </ScrollView>
          <Text variant="introCaption" color="redesign.secondary" style={styles.filterNote}>{t('g10.filterUnavailable')}</Text>
        </View>}
        ListEmptyComponent={listState}
        ListFooterComponent={
          canRead && inbox.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: spacing[4] }} /> : null
        }
        renderItem={({ item, index }) => <NotificationCard item={item} index={index}
          busy={openingId !== null && openingId === item.id} reading={!!item.id && readingIds.has(item.id)}
          onOpen={() => void open(item)} onLater={() => mark(item)} /> }
      />
      <ResultSheet visible={!!readProblem} variant="error" title={t('g10.readFailed')} body={t(readProblem === 'all' ? 'g10.readAllFailedBody' : 'g10.readFailedBody')}
        secondaryAction={readProblem === 'all' ? { label: t('g10.reload'), onPress: () => { setReadProblem(null); void inbox.refetch(); void summary.refetch() } } : undefined}
        primaryAction={{ label: t('common.close'), onPress: () => setReadProblem(null) }} onClose={() => setReadProblem(null)} />
    </Atmosphere>
  )
}
