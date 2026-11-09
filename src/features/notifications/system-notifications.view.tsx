import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, View } from 'react-native'
import { useRouter } from 'expo-router'
import type { useSystemNotificationsQuery } from '@/shared/api/queries/use-system-notifications'
import { parseApiDate } from '@/shared/api'
import { parseDeepLink, routeForAction } from '@/shared/navigation/deep-link'
import { Card, SecondaryBtn } from '@/shared/ui/primitives'
import { EmptyState, ErrorState, OfflineState, StaleNotice } from '@/shared/ui/async-state.view'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { styles } from './system-notifications.style'

type Props = { inbox: ReturnType<typeof useSystemNotificationsQuery>; illustration: ReactNode }
export function SystemNotificationsSection({ inbox, illustration }: Props) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const items = inbox.data?.pages.flatMap(page => page.items) ?? []
  return <View testID="system-notifications-section">
    <Text accessibilityRole="header" variant="introHeading" color="redesign.ink" style={styles.sectionTitle}>{t('g10.systemTitle')}</Text>
    {inbox.status === 'unsupported' ? <View testID="system-notifications-unsupported" style={styles.empty}>
      <EmptyState appearance="stitch" title={t('g10.systemUnavailableTitle')} body={t('g10.systemUnavailableBody')} illustration={illustration} />
    </View> : inbox.isPaused && !inbox.data ? <OfflineState /> : inbox.isPending ? <View testID="system-notifications-loading"><Skeleton width="100%" height={96} /></View>
      : inbox.isError && !inbox.data ? <ErrorState error={inbox.error} onRetry={() => void inbox.refetch()} /> : <>
        <StaleNotice hasData={!!inbox.data} error={inbox.error} onRetry={() => void inbox.refetch()} />
        {items.map(item => {
          const action = parseDeepLink(item.deepLink)
          const canOpen = action.kind !== 'unknown'
          const published = parseApiDate(item.publishedAt)
          return <Card key={item.id} appearance="stitch" padded={false} style={styles.row}>
            <View style={styles.iconTile}><Icon name={item.kind === 'maintenance' ? 'settings' : item.kind === 'update' ? 'sparkle' : 'info'} size={24} color="redesign.secondary" /></View>
            <View style={styles.content}>
              <Text variant="introLabel" color="redesign.ink">{item.title}</Text>
              <Text variant="introBody" color="redesign.ink" style={styles.body}>{item.body}</Text>
              {published ? <Text variant="introCaption" color="redesign.secondary" style={styles.body}>{published.toLocaleString(i18n.language)}</Text> : null}
              {canOpen ? <SecondaryBtn size="small" variant="neutralPill" label={t('g10.viewDetails')} onPress={() => router.push(routeForAction(action))} /> : null}
            </View>
          </Card>
        })}
        {!items.length ? <View style={styles.empty}><EmptyState appearance="stitch" title={t('g10.systemEmpty')} illustration={illustration} /></View> : null}
        {inbox.isFetchingNextPage ? <ActivityIndicator accessibilityLabel={t('common.loading')} style={styles.loadingFooter} /> : inbox.hasNextPage ? <SecondaryBtn size="small" variant="neutralPill" label={t('g10.loadMore')} onPress={() => void inbox.fetchNextPage({ cancelRefetch: false })} /> : null}
      </>}
  </View>
}
