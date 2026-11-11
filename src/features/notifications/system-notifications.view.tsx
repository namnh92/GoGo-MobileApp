import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import type { useSystemNotificationsQuery } from '@/shared/api/queries/use-system-notifications'
import { parseApiDate } from '@/shared/api'
import type { SystemNotification } from '@/shared/api/system-notifications'
import { parseDeepLink, routeForAction } from '@/shared/navigation/deep-link'
import { SecondaryBtn } from '@/shared/ui/primitives'
import { EmptyState, ErrorState, OfflineState, StaleNotice } from '@/shared/ui/async-state.view'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { LoadingIndicator } from '@/shared/ui/loading-indicator.view'
import { NotificationListSkeleton } from '@/shared/ui/skeleton.view'
import { NotificationRow } from './notification-row.view'
import { formatNotificationTime } from './notification-time'
import { styles } from './system-notifications.style'

type Props = { inbox: ReturnType<typeof useSystemNotificationsQuery>; illustration: ReactNode }
export function SystemNotificationsSection({ inbox, illustration }: Props) {
  const { t } = useTranslation()
  const items = inbox.data?.pages.flatMap(page => page.items) ?? []
  return <View testID="system-notifications-section">
    <Text accessibilityRole="header" variant="introHeading" color="text.primary" style={styles.sectionTitle}>{t('g10.systemTitle')}</Text>
    {inbox.status === 'unsupported' ? <View testID="system-notifications-unsupported" style={styles.empty}>
      <EmptyState appearance="stitch" title={t('g10.systemUnavailableTitle')} body={t('g10.systemUnavailableBody')} illustration={illustration} />
    </View> : inbox.isPaused && !inbox.data ? <OfflineState /> : inbox.isPending ? <NotificationListSkeleton testID="system-notifications-loading" />
      : inbox.isError && !inbox.data ? <ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} /> : <>
        <StaleNotice hasData={!!inbox.data} error={inbox.error} onRetry={() => void inbox.refetch()} />
        {items.map(item => <SystemNotificationRow key={item.id} item={item} />)}
        {!items.length ? <View style={styles.empty}><EmptyState appearance="stitch" title={t('g10.systemEmpty')} body={t('g10.systemEmptyBody')} illustration={illustration} /></View> : null}
        {inbox.isFetchingNextPage ? <LoadingIndicator accessibilityLabel={t('common.loading')} style={styles.loadingFooter} /> : inbox.hasNextPage ? <SecondaryBtn size="small" variant="neutralPill" label={t('g10.loadMore')} onPress={() => void inbox.fetchNextPage({ cancelRefetch: false })} /> : null}
      </>}
  </View>
}

/** Public broadcasts have no per-user read state. Reuse this row in both session layouts. */
export function SystemNotificationRow({ item }: { item: SystemNotification }) {
  const { t } = useTranslation()
  const router = useRouter()
  const action = parseDeepLink(item.deepLink)
  const canOpen = action.kind !== 'unknown'
  const published = parseApiDate(item.publishedAt)
  return <NotificationRow id={item.id} testID={`system-notification-${item.id}`} headingTestID={`notification-public-heading-${item.id}`}
    title={item.title} relativeTime={published ? formatNotificationTime(published, t) : null}
    icon={<Icon name={item.kind === 'maintenance' ? 'settings' : item.kind === 'update' ? 'sparkle' : 'info'} size={24} color="text.secondary" />}
    actions={canOpen ? <SecondaryBtn size="small" variant="neutralPill" label={t('g10.viewDetails')} onPress={() => router.push(routeForAction(action))} /> : null}>
    <Text variant="introBody" color="text.primary" style={styles.body}>{item.body}</Text>
  </NotificationRow>
}
