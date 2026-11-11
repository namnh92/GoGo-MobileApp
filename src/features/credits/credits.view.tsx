import { useCallback } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { FlatList, View } from 'react-native'
import { useMe, useMyCreditLedger, useMyCredits } from '@/shared/api'
import { useSession } from '@/shared/providers/session-provider'
import { useOnlineStatus } from '@/shared/api/queries/use-online-status'
import { AppHeader } from '@/shared/ui/app-header.view'
import { Atmosphere, Card, GhostBtn, PrimaryBtn } from '@/shared/ui/primitives'
import { EmptyState, ErrorState, OfflineState, StaleNotice } from '@/shared/ui/async-state.view'
import { PullToRefresh } from '@/shared/ui/refresh-control.view'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { Text } from '@/shared/ui/text'
import { LoadingIndicator } from '@/shared/ui/loading-indicator.view'
import { goBackOrHome } from '@/shared/navigation/go-back-or-home'
import { creditEntries, creditLocale, creditSourceKey, creditsAvailable, formatCredit, groupCreditEntries, creditEventLabel } from './credit-format'
import { styles } from './credits.style'

export default function CreditsScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { status } = useSession()
  const user = status === 'user'
  const me = useMe({ enabled: user })
  const enabled = user && creditsAvailable(me.data)
  const summary = useMyCredits(enabled)
  const ledger = useMyCreditLedger(enabled)
  const online = useOnlineStatus()
  const { refetch: refetchSummary } = summary
  const { refetch: refetchLedger } = ledger
  useFocusEffect(useCallback(() => {
    if (enabled) { void refetchSummary(); void refetchLedger() }
  }, [enabled, refetchSummary, refetchLedger]))
  const refresh = () => enabled ? Promise.all([summary.refetch(), ledger.refresh()]) : me.refetch()
  const entries = enabled ? creditEntries(ledger.data?.pages) : []
  const groups = groupCreditEntries(entries)
  const skeleton = <View testID="credits-loading" style={styles.skeleton}>{[0, 1, 2].map(index => <Skeleton key={index} height={64} />)}</View>
  const retry = () => void refresh()
  const state = !user ? <EmptyState title={t('notifications.signInTitle')} action={<PrimaryBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />} />
    : !enabled ? (!online ? <OfflineState /> : me.isPending ? skeleton : me.isError ? <ErrorState error={me.error} onRetry={() => void me.refetch()} /> : <EmptyState title={t('credits.unavailable')} />)
      : !online && !ledger.data ? <OfflineState /> : ledger.isPending ? skeleton
        : ledger.isError && !ledger.data ? <ErrorState error={ledger.error} onRetry={retry} />
          : <EmptyState title={t('credits.empty')} body={t('credits.emptyBody')} action={<GhostBtn label={t('credits.contribute')} onPress={() => router.push('/places/contribution')} />} />
  return <Atmosphere redesign>
    <AppHeader title={t('credits.history')} showNotifications={false} onBack={() => goBackOrHome(router)} />
    <PullToRefresh enabled={user} onRefresh={async () => { await refresh() }}>
      <FlatList testID="credits-ledger" data={groups} keyExtractor={group => group.key} contentContainerStyle={styles.content}
        ListHeaderComponent={enabled ? <View>
          <Card style={styles.card}>
            <Text variant="title2">{t('credits.title')}</Text>
            {summary.data ? <View accessibilityLiveRegion="polite">
              {(['balance', 'earned', 'spent', ...(summary.data.reserved > 0 ? ['reserved', 'availableBalance'] as const : [])] as const).map(key => <View key={key} style={styles.row}>
                <Text style={styles.label}>{t(key === 'availableBalance' ? 'credits.available' : `credits.${key}`)}</Text>
                <Text variant="title2">{formatCredit(summary.data![key], i18n.language)}</Text>
              </View>)}
            </View> : !online ? <OfflineState /> : summary.isError ? <ErrorState error={summary.error} onRetry={() => void summary.refetch()} /> : <Skeleton height={100} />}
          </Card>
          <StaleNotice hasData={!!summary.data || !!ledger.data} error={summary.error ?? (ledger.isFetchNextPageError ? null : ledger.error)} onRetry={retry} />
        </View> : null}
        ListEmptyComponent={state}
        renderItem={({ item: group }) => <View>
          {group.firstOfDay ? <Text variant="title2" style={styles.day}>{new Date(group.date).toLocaleDateString(creditLocale(i18n.language))}</Text> : null}
          <View style={styles.entry} testID="credit-history-group">
            <Text variant="title2">{group.conversation ? group.conversation.title?.trim() || t('credits.untitledConversation') : t(group.usage ? 'credits.deletedConversation' : 'credits.otherActivity')}</Text>
            {group.entries.map(item => <View key={item.id}>
              <View style={styles.row}><Text style={styles.label}>{creditEventLabel(item, i18n.language) ?? t(creditSourceKey(item))}</Text><Text variant="title2">{formatCredit(item.delta, i18n.language, true)}</Text></View>
              <Text variant="caption" color="text.secondary">{new Date(item.createdAt).toLocaleTimeString(creditLocale(i18n.language))}</Text>
            </View>)}
            <Text variant="bodySmall">{t('credits.groupTotal', { total: formatCredit(group.total, i18n.language, true) })}</Text>
          </View>
        </View>}
        ListFooterComponent={enabled && ledger.data ? <View>
          {ledger.isFetchingNextPage ? <LoadingIndicator accessibilityLabel={t('common.loading')} />
            : ledger.isFetchNextPageError ? <View testID="credits-footer-error"><Text>{t('credits.loadMoreError')}</Text><GhostBtn label={t('common.retry')} disabled={!online} onPress={() => void ledger.fetchNextPage()} /></View>
              : ledger.hasNextPage ? <GhostBtn label={t('g10.loadMore')} disabled={!online || ledger.isFetching} onPress={() => void ledger.fetchNextPage()} /> : null}
        </View> : null}
      />
    </PullToRefresh>
  </Atmosphere>
}
