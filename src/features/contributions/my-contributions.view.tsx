import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, RefreshControl, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useMyPlaceSubmissions } from '@/shared/api/queries/use-my-place-submissions'
import type { MyPlaceSubmission } from '@/shared/api/endpoints/my-place-submissions'
import { useSession } from '@/shared/providers/session-provider'
import { openWebsite } from '@/shared/navigation/external-links'
import { EmptyState, ErrorState, LoadingState, OfflineState } from '@/shared/ui/async-state.view'
import { Atmosphere, BackHeader, Chip, GhostBtn, PrimaryBtn } from '@/shared/ui/primitives'
import { MaterialIcon, type MaterialIconName } from '@/shared/ui/material-icon'
import { Text, type TextColor } from '@/shared/ui/text'
import { spacing } from '@/shared/ui/tokens'
import { styles } from './my-contributions.style'

type Filter = 'all' | 'pending' | 'approved' | 'rejected'
const filters: Filter[] = ['all', 'pending', 'approved', 'rejected']
const statuses: Record<MyPlaceSubmission['status'], { icon: MaterialIconName; color: TextColor }> = {
  pending: { icon: 'clock', color: 'status.warningText' },
  approved: { icon: 'checkCircle', color: 'status.successText' },
  merged: { icon: 'link', color: 'status.successText' },
  rejected: { icon: 'close', color: 'status.dangerText' },
}
function submissionDate(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

export default function MyContributionsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { status } = useSession()
  const registered = status === 'user'
  const query = useMyPlaceSubmissions(registered)
  const [filter, setFilter] = useState<Filter>('all')
  // Deduplicate defensively across pages; filtered lists retain the same cursor.
  const items = [...new Map((query.data?.pages.flatMap(page => page.items) ?? []).map(item => [item.id, item])).values()]
  const visible = items.filter(item => filter === 'all' || item.status === filter || (filter === 'approved' && item.status === 'merged'))
  const loadMore = () => { if (query.hasNextPage && !query.isFetching) void query.fetchNextPage() }
  return (
    <Atmosphere>
      <View style={{ paddingTop: insets.top }}><BackHeader title={t('myContributions.title')} onBack={() => router.back()} /></View>
      {!registered ? <EmptyState title={t('notifications.signInTitle')} body={t('myContributions.signInBody')}
        action={<GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />} /> : <>
        <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filters.map(value => <Chip key={value} label={t(`myContributions.filter.${value}`)} variant={filter === value ? 'selected' : 'default'} onPress={() => setFilter(value)} />)}
        </ScrollView></View>
        <FlatList
          testID="my-contributions-list"
          data={visible}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => { void query.refetch() }} />}
          onEndReached={() => { if (!query.isError) loadMore() }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={query.isPending ? (query.isPaused ? <OfflineState /> : <LoadingState />) : query.isError ? null : <EmptyState
            title={t('myContributions.emptyTitle')}
            body={t(query.hasNextPage ? 'myContributions.noLoadedMatches' : 'myContributions.emptyBody')} />}
          ListFooterComponent={<>
            {query.isError ? <ErrorState error={query.error} onRetry={() => { if (query.isFetchNextPageError) loadMore(); else void query.refetch() }} /> : null}
            {query.isFetchingNextPage ? <LoadingState /> : query.hasNextPage && !query.isError ? <GhostBtn label={t('myContributions.loadMore')} onPress={loadMore} /> : null}
          </>}
          renderItem={({ item }) => {
            const tone = statuses[item.status]
            return <View style={styles.card}>
              <View style={styles.row}>
                {item.photoUrl ? <Image source={{ uri: item.photoUrl }} style={styles.photo} accessibilityLabel={item.name ?? t('myContributions.unknownPlace')} cachePolicy="none" /> : <View testID="contribution-photo-placeholder" style={styles.photo}><MaterialIcon name="storefront" size={32} /></View>}
                <View style={styles.details}>
                  <Text variant="title2">{item.name ?? t('myContributions.unknownPlace')}</Text>
                  {[...new Set(item.providerDisplay?.attributions ?? [])].map(attribution => (
                    <Text key={attribution} variant="caption" color="text.secondary"
                      accessibilityRole={item.providerDisplay?.googleMapsUri ? 'link' : undefined}
                      onPress={item.providerDisplay?.googleMapsUri ? () => { void openWebsite(item.providerDisplay!.googleMapsUri!) } : undefined}>
                      {attribution}
                    </Text>
                  ))}
                  <Text variant="caption" color="text.secondary">{t('myContributions.sentDate', { date: submissionDate(item.createdAt) })}</Text>
                  <View style={styles.status}><MaterialIcon name={tone.icon} color={tone.color} /><Text variant="caption" color={tone.color}>{t(`myContributions.status.${item.status}`)}</Text></View>
                </View>
              </View>
              {item.status === 'rejected' ? <Text variant="bodySmall" color="status.dangerText">{t(`myContributions.rejection.${item.rejectionReason ?? 'other'}`, { defaultValue: t('myContributions.rejection.other') })}</Text> : null}
              {(item.status === 'approved' || item.status === 'merged') && item.placeId ? <GhostBtn label={t('myContributions.viewPlace')} onPress={() => router.push({ pathname: '/places/[placeId]', params: { placeId: item.placeId! } })} /> : null}
            </View>
          }}
        />
      </>}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing[5] }]}><PrimaryBtn label={t('myContributions.add')} onPress={() => router.push('/places/import')} /></View>
    </Atmosphere>
  )
}
