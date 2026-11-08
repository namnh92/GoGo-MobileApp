import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { detailToPlaceCard, useMyReviews, usePlaceDetail, useSaved, useToggleSaved } from '@/shared/api'
import { useMyPlaceSubmission, useMyPlaceSubmissions } from '@/shared/api/queries/use-my-place-submissions'
import { useOnlineStatus } from '@/shared/api/queries/use-online-status'
import type { components } from '@/shared/api/types'
import { isSubmissionDetailRetryable, type MyPlaceSubmission } from '@/shared/api/endpoints/my-place-submissions'
import { useSession } from '@/shared/providers/session-provider'
import { openWebsite } from '@/shared/navigation/external-links'
import { EmptyState, ErrorState, LoadingState, OfflineState } from '@/shared/ui/async-state.view'
import { Atmosphere, BackHeader, GhostBtn } from '@/shared/ui/primitives'
import { HeaderNotificationButton } from '@/shared/ui/header-notification-button.view'
import { FilledSegmentedControl } from '@/shared/ui/filled-segmented-control.view'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { mapsUrlSchema } from '@/features/place-import/maps-url'
import { Icon } from '@/shared/ui/icons'
import { Text } from '@/shared/ui/text'
import { PlaceCard } from '@/shared/ui/place-card.view'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { Badge } from '@/shared/ui/badge.view'
import { styles } from './my-contributions.style'

type Filter = 'all' | 'pending' | 'approved' | 'rejected' | 'removed'
type Review = components['schemas']['MyReview']
type Tab = 'places' | 'reviews'
const filters: Filter[] = ['all', 'pending', 'approved', 'rejected']
function matches(status: string, filter: Filter) {
  return filter === 'all' || status === filter || (filter === 'approved' && ['merged', 'published'].includes(status))
}
function dateLabel(value?: string) {
  const date = value ? new Date(value) : null
  if (!date || !Number.isFinite(date.getTime())) return null
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

function ContributionPlace({ item }: { item: MyPlaceSubmission }) {
  const { t } = useTranslation()
  const router = useRouter()
  const canonical = item.status === 'approved' || item.status === 'merged'
  const detail = usePlaceDetail(canonical ? item.placeId : undefined)
  const saved = useSaved({ enabled: canonical && !!item.placeId })
  const toggle = useToggleSaved()
  const online = useOnlineStatus()
  const needsHydration = !canonical && (item.providerStatus === 'deferred' || !item.name?.trim() || !item.addressShort?.trim())
  const submission = useMyPlaceSubmission(item, needsHydration && online)
  const display = needsHydration && submission.data ? { ...item, ...submission.data } : item
  const provider = display.providerDisplay ?? item.providerDisplay
  const link = mapsUrlSchema.safeParse(provider?.googleMapsUri ?? item.providerDisplay?.googleMapsUri)
  const url = link.success ? link.data : undefined
  // An available Maps URL identifies the record without exposing its path/query
  // (or mistaking the URI for a verified place name).
  const realName = display.name?.trim() || item.name?.trim() || provider?.name?.trim() || item.providerDisplay?.name?.trim()
  const name = realName || (url ? new URL(url).hostname : t('contributions.submittedMapsLink'))
  const address = display.addressShort?.trim() || item.addressShort?.trim() || provider?.addressShort?.trim() || item.providerDisplay?.addressShort?.trim()
  const canRetry = submission.isError && isSubmissionDetailRetryable(submission.error)
  const factsUnavailable = submission.data && (['budget_exhausted', 'deferred'].includes(display.providerStatus ?? '') || !realName || !address)
  const card = detailToPlaceCard({ id: item.id, name, addressText: address, ...detail.data })
  if (!card.photoUrl && item.photoUrl) card.photoUrl = item.photoUrl
  const canSave = canonical && !!item.placeId && !!detail.data && !detail.isError && saved.data != null && !saved.isError && online
  const isSaved = saved.data?.some(row => row.targetType === 'place' && row.targetId === item.placeId) ?? false
  const saveReason = !canonical ? t('contributions.saveLocked') : !online ? t('common.offlineBody') : t('contributions.saveUnavailable')
  return <PlaceCard place={card} appearance="contribution"
    onPress={canonical && item.placeId ? () => router.push({ pathname: '/places/[placeId]', params: { placeId: item.placeId! } }) : undefined}
    contributionBadge={<Badge appearance="solid" icon={item.status === 'pending' ? 'clock' : item.status === 'rejected' ? 'close' : 'checkCircle'}
      tone={item.status === 'pending' ? 'warning' : item.status === 'rejected' ? 'danger' : 'success'} label={t(`myContributions.status.${item.status}`)} />}
    headerAction={<Pressable testID={`contribution-save-${item.id}`} accessibilityRole="button" accessibilityState={{ disabled: !canSave || toggle.isPending, selected: isSaved, busy: toggle.isPending }}
      accessibilityLabel={canSave ? t(isSaved ? 'saved.remove' : 'placeDetail.save') : saveReason}
      disabled={!canSave || toggle.isPending} onPress={() => toggle.mutate({ type: 'place', id: item.placeId!, saved: isSaved })}
      style={({ pressed }) => [styles.bookmark, pressed && styles.pressed, !canSave && styles.unavailable]}>
      <MaterialIcon name={!canSave ? 'lock' : isSaved ? 'bookmarkFilled' : 'bookmark'} size={22} color="text.secondary" />
    </Pressable>}
    footer={<>
      {[...new Set(provider?.attributions ?? [])].map(attribution => <Text key={attribution} variant="caption" color="text.secondary"
        accessibilityRole={url ? 'link' : undefined} onPress={url ? () => { void openWebsite(url) } : undefined}>{attribution}</Text>)}
      {needsHydration && submission.isFetching ? <LoadingState /> : null}
      {needsHydration && submission.isError ? <ErrorState error={submission.error} /> : null}
      {needsHydration && !submission.isFetching && !submission.isError && factsUnavailable ?
        <Text variant="caption" color="text.secondary">{t('contributions.detailsPending')}</Text> : null}
      {needsHydration && !submission.isFetching && canRetry ?
        <GhostBtn label={t('common.retry')} disabled={!online} onPress={() => { void submission.refetch() }} /> : null}
      {!canSave ? <Text variant="caption" color="text.secondary">{saveReason}</Text> : null}
      {toggle.isError ? <ErrorState error={toggle.error} onRetry={() => { if (canSave) toggle.mutate({ type: 'place', id: item.placeId!, saved: isSaved }) }} /> : null}
      {item.status === 'rejected' && item.rejectionReason ? <View style={styles.rejection}><MaterialIcon name="info" color="status.dangerText" size={18} /><Text variant="caption" color="status.dangerText" style={styles.flex}>{t('contributions.reason', { reason: t(`myContributions.rejection.${item.rejectionReason}`, { defaultValue: t('myContributions.rejection.other') }) })}</Text></View> : null}
      <View style={styles.metadata}>
        <Text variant="caption" color="text.secondary">{t('myContributions.sentDate', { date: dateLabel(item.createdAt) })}</Text>
        {item.status === 'rejected' ? <Pressable accessibilityRole="link" accessibilityState={{ disabled: !url }} disabled={!url}
          onPress={() => router.push({ pathname: '/places/import', params: { url: url! } })} style={styles.linkTarget}>
          <Text variant="label" color={url ? 'accent.primary' : 'text.secondary'}>{t('contributions.supplement')}</Text>
        </Pressable> : <Badge label={t(canonical ? 'contributions.live' : 'contributions.moderating')} tone={canonical ? 'success' : 'warning'} />}
      </View>
      {item.status === 'rejected' && !url ? <Text variant="caption" color="text.secondary">{t('contributions.linkUnavailable')}</Text> : null}
    </>} />
}

function ContributionReview({ review }: { review: Review }) {
  const { t } = useTranslation()
  const router = useRouter()
  const place = usePlaceDetail(review.placeId)
  const card = place.data ? detailToPlaceCard(place.data) : undefined
  const name = review.placeName ?? place.data?.name ?? t(review.placeId ? 'myReviews.placeFallback' : 'review.subjectOverall')
  const address = review.placeAddressText ?? card?.addressText
  const date = dateLabel(review.createdAt)
  return <View style={styles.reviewCard}>
    <View style={styles.row}>
      {card?.photoUrl ? <PlacePhoto placeId={review.placeId!} name={name} uri={card.photoUrl} style={styles.reviewPhoto} /> : null}
      <View style={styles.flex}>
        <View style={styles.row}><Pressable style={styles.flex} accessibilityRole={review.placeId ? 'button' : undefined}
          onPress={review.placeId ? () => router.push({ pathname: '/places/[placeId]', params: { placeId: review.placeId! } }) : undefined}>
          <Text variant="label" numberOfLines={1}>{name}</Text>
        </Pressable>{review.status !== 'published' ? <Badge tone={review.status === 'pending' ? 'warning' : 'danger'} label={t(review.status === 'pending' ? 'myContributions.status.pending' : `myReviews.status.${review.status}`)} /> : null}</View>
        {address ? <Text variant="caption" color="text.secondary" numberOfLines={1}>{address}</Text> : null}
        <View style={styles.stars} accessible accessibilityLabel={t('myReviews.yourRating', { count: review.rating })}>
          {[1, 2, 3, 4, 5].map(value => <Icon key={value} name="star" size={14} color={value <= review.rating ? 'status.warningText' : 'text.secondary'} filled={value <= review.rating} />)}
          <Text variant="caption" color="text.secondary">{review.rating.toFixed(1)}</Text>
        </View>
      </View>
    </View>
    {review.text ? <Text variant="bodySmall" color="text.secondary" numberOfLines={2}>{review.text}</Text> : null}
    {review.status === 'rejected' && review.rejectionReason ? <Text variant="caption" color="status.dangerText">{t('contributions.reason', { reason: review.rejectionReason })}</Text> : null}
    <View style={styles.metadata}>{date ? <Text variant="caption" color="text.secondary">{t('contributions.writtenDate', { date })}</Text> : null}
      {review.status === 'published' ? <Text variant="caption" color="status.successText">✓ {t('contributions.published')}</Text> : null}
    </View>
  </View>
}

export default function MyContributionsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const params = useLocalSearchParams<{ tab?: string }>()
  const insets = useSafeAreaInsets()
  const registered = useSession().status === 'user'
  const query = useMyPlaceSubmissions(registered)
  const reviews = useMyReviews({ enabled: registered })
  const online = useOnlineStatus()
  const [tab, setTab] = useState<Tab>(params.tab === 'reviews' ? 'reviews' : 'places')
  const [filter, setFilter] = useState<Filter>('all')
  const items = [...new Map((query.data?.pages.flatMap(page => page.items) ?? []).map(item => [item.id, item])).values()]
  const reviewItems = reviews.data ?? []
  const active = tab === 'places' ? query : reviews
  const statuses = tab === 'places' ? items : reviewItems
  const options = [...filters.filter(value => tab === 'places' || value !== 'rejected' || reviewItems.some(row => row.status === 'rejected')), ...(tab === 'reviews' && reviewItems.some(row => row.status === 'removed') ? ['removed' as const] : [])]
  const loadMore = () => { if (query.hasNextPage && !query.isFetching && online) void query.fetchNextPage() }
  const emptyAction = <GhostBtn label={t(tab === 'places' ? 'contributions.emptyAdd' : 'contributions.explore')}
    onPress={() => router.push(tab === 'places' ? '/places/import' : '/(tabs)')} />
  const emptyTitle = filter === 'all' ? t(`contributions.empty.${tab}.title`) :
    t(`contributions.empty.${tab}.${filter}`)
  const emptyList = active.isPending ? (!online || active.isPaused ? <OfflineState /> : <LoadingState />) : active.isError ? null :
    tab === 'places' && query.hasNextPage ? <EmptyState title={t('myContributions.emptyTitle')} body={t('myContributions.noLoadedMatches')} action={emptyAction} /> :
      <EmptyState title={emptyTitle} body={t(`contributions.empty.${tab}.body`)} action={emptyAction} />
  const footer = <>
    {active.isError ? <ErrorState error={active.error} onRetry={() => { if (tab === 'places' && query.isFetchNextPageError) loadMore(); else void active.refetch() }} /> : null}
    {tab === 'places' && query.isFetchingNextPage ? <LoadingState /> : tab === 'places' && query.hasNextPage && !query.isError ? <GhostBtn label={t('myContributions.loadMore')} onPress={loadMore} disabled={!online} /> : null}
  </>
  const refresh = <RefreshControl refreshing={!!active.isRefetching && !(tab === 'places' && query.isFetchingNextPage)} onRefresh={() => { void active.refetch() }} />
  return <Atmosphere>
    <View style={{ paddingTop: insets.top }}><BackHeader title={t('myContributions.title')} onBack={() => router.back()}
      right={<HeaderNotificationButton testID="contributions-bell" unreadDotTestID="contributions-unread" />} /></View>
    {!registered ? <EmptyState title={t('notifications.signInTitle')} body={t('myContributions.signInBody')} action={<GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />} /> : <>
      <FilledSegmentedControl value={tab} onChange={value => { setTab(value); setFilter('all') }}
        options={(['places', 'reviews'] as const).map(value => ({ value, label: (value === 'places' ? query.data : reviews.data) == null
          ? t(`contributions.${value}`)
          : t('myReviews.filterChip', { label: t(`contributions.${value}`), count: value === 'places' ? `${items.length}${query.hasNextPage ? '+' : ''}` : reviewItems.length }),
        }))} />
      <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{options.map(value => <Pressable key={value}
        accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={({ pressed }) => [styles.chip, filter === value && styles.selectedChip, pressed && styles.pressed]}>
        <Text variant="caption" numberOfLines={1} color={filter === value ? 'surface.canvas' : 'text.primary'}>{active.data == null ? t(value === 'removed' ? 'myReviews.status.removed' : `myContributions.filter.${value}`) : t('myReviews.filterChip', { label: t(value === 'removed' ? 'myReviews.status.removed' : `myContributions.filter.${value}`), count: `${statuses.filter(row => matches(row.status, value)).length}${tab === 'places' && query.hasNextPage ? '+' : ''}` })}</Text>
      </Pressable>)}</ScrollView></View>
      {!online && !active.isPending ? <OfflineState /> : null}
      {tab === 'places' ? <FlatList testID="my-contributions-list" data={items.filter(item => matches(item.status, filter))} keyExtractor={item => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]} refreshControl={refresh} onEndReached={() => { if (!query.isError) loadMore() }} onEndReachedThreshold={0.3}
        ListEmptyComponent={emptyList} ListFooterComponent={footer} renderItem={({ item }) => <ContributionPlace item={item} />} /> :
        <FlatList testID="my-contributions-reviews" data={reviewItems.filter(item => matches(item.status, filter))} keyExtractor={item => item.id}
          contentContainerStyle={styles.list} refreshControl={refresh} ListEmptyComponent={emptyList} ListFooterComponent={footer} renderItem={({ item }) => <ContributionReview review={item} />} />}
    </>}
    {registered && tab === 'places' ? <Pressable testID="contributions-add-fab" accessibilityRole="button"
      accessibilityLabel={t('myContributions.add')} onPress={() => router.push('/places/import')}
      style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 16 }, pressed && styles.fabPressed]}>
      <MaterialIcon name="plus" size={28} color="accent.onAccent" />
    </Pressable> : null}

  </Atmosphere>
}
