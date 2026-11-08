import { AppHeader } from '@/shared/ui/app-header.view'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AccessibilityInfo, ActivityIndicator, FlatList, Platform, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useMarkNotificationRead, useNotifications, type Notification } from '@/shared/api'
import { SessionCancelledError } from '@/shared/api/session'
import { PUSH_UNAVAILABLE_NOTICE } from '@/shared/notifications/notification-target'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState, OfflineState, StaleNotice } from '@/shared/ui/async-state.view'
import { Atmosphere, GhostBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Text } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'

import { resolveInboxTarget } from './inbox-target'
import { NotificationCard } from './notification-card.view'
import { notificationCapabilities } from './notification-capabilities'
import { Chip } from '@/shared/ui/chip.view'
import { Icon } from '@/shared/ui/icons'
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
  const inbox = useNotifications({ enabled: canRead })
  const markRead = useMarkNotificationRead()
  const capabilities = notificationCapabilities()
  const [readProblem, setReadProblem] = useState(false)
  const [readingIds, setReadingIds] = useState<ReadonlySet<string>>(() => new Set())
  const readingNow = useRef(new Set<string>())

  function mark(notification: Notification) {
    const id = notification.id
    if (!id || notification.readAt || readingNow.current.has(id)) return
    readingNow.current.add(id)
    setReadingIds(current => new Set(current).add(id))
    setReadProblem(false)
    void markRead.mutateAsync(id).catch(error => {
      if (!(error instanceof SessionCancelledError)) setReadProblem(true)
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
      <AppHeader showNotifications={false} onBack={() => goBackOrHome(router)} title={t('notifications.title')} />
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
      <Atmosphere redesign>
        {header}
        <EmptyState
          title={t('notifications.signInTitle')}
          body={t('notifications.signInBody')}
          action={<GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />}
        />
      </Atmosphere>
    )
  }

  if (inbox.isPending || inbox.isPaused && !inbox.data) {
    return (
      <Atmosphere redesign>
        {header}
        {inbox.isPaused ? <OfflineState /> : <View testID="notifications-loading" style={styles.list} accessibilityRole="progressbar" accessibilityLabel={t('common.loading')}>
          {[0, 1, 2].map(key => <View key={key} style={styles.skeletonRow}><Skeleton width={48} height={48} radius={24} /><View style={styles.content}><Skeleton width="65%" height={14} /><Skeleton width="100%" height={48} /></View></View>)}
        </View>}
      </Atmosphere>
    )
  }

  if (inbox.isError && !inbox.data) {
    return (
      <Atmosphere redesign>
        {header}
        <ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} />
      </Atmosphere>
    )
  }

  return (
    <Atmosphere redesign>
      {header}
      <FlatList
        data={items}
        keyExtractor={item => item.id ?? String(item.createdAt)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing[6] }]}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (inbox.hasNextPage && !inbox.isFetchingNextPage) void inbox.fetchNextPage()
        }}
        ListHeaderComponent={<View>
          <StaleNotice hasData={!!inbox.data} error={inbox.error} onRetry={() => void inbox.refetch()} />
          <View style={styles.toolbar}>
            <Text variant="introHeading" color="redesign.ink" style={styles.kind}>{t('g10.allNotifications')}</Text>
            <SecondaryBtn size="small" variant="neutral" label={t('g10.readAll')} disabled={!capabilities.readAll}
              accessibilityHint={t('g10.readAllUnavailable')} onPress={() => undefined} />
          </View>
          <Text variant="introCaption" color="redesign.secondary">{t('g10.readAllUnavailable')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            <Chip label={t('g10.filter.all')} variant="selected" />
            <Chip label={t('g10.filter.invite')} icon="users" disabled={!capabilities.categoryFilter} onPress={() => undefined}
              accessibilityLabel={`${t('g10.filter.invite')}. ${t('g10.filterUnavailable')}`} />
            <Chip label={t('g10.filter.plan')} icon="map" disabled={!capabilities.categoryFilter} onPress={() => undefined}
              accessibilityLabel={`${t('g10.filter.plan')}. ${t('g10.filterUnavailable')}`} />
            <Chip label={t('g10.filter.date')} icon="clock" disabled={!capabilities.categoryFilter} onPress={() => undefined}
              accessibilityLabel={`${t('g10.filter.date')}. ${t('g10.filterUnavailable')}`} />
          </ScrollView>
          <Text variant="introCaption" color="redesign.secondary" style={styles.filterNote}>{t('g10.filterUnavailable')}</Text>
        </View>}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIllustration}><Icon name="mail" size={44} color="redesign.violetText" /></View>
            <EmptyState title={t('g10.emptyTitle')} body={t('g10.emptyBody')}
              action={<SecondaryBtn variant="neutral" label={t('g10.reload')} loading={inbox.isRefetching} onPress={() => void inbox.refetch()} />} />
          </View>
        }
        ListFooterComponent={
          inbox.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: spacing[4] }} /> : null
        }
        renderItem={({ item, index }) => <NotificationCard item={item} index={index}
          busy={openingId !== null && openingId === item.id} reading={!!item.id && readingIds.has(item.id)}
          onOpen={() => void open(item)} onLater={() => mark(item)} /> }
      />
      <GhostBtn label={t('g10.settingsTitle')} onPress={() => router.push('/settings/notifications')} />
      <ResultSheet visible={readProblem} variant="error" title={t('g10.readFailed')} body={t('g10.readFailedBody')}
        primaryAction={{ label: t('common.close'), onPress: () => setReadProblem(false) }} onClose={() => setReadProblem(false)} />
    </Atmosphere>
  )
}
