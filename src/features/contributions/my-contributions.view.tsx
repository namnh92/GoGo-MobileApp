import { AppTabDock } from '@/shared/ui/app-tab-dock.view'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { AppHeader } from '@/shared/ui/app-header.view'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlatList, RefreshControl, ScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { detailToPlaceCard, useMyReviews, usePlaceDetail } from '@/shared/api'
import { useMyPlaceSubmission, useMyPlaceSubmissions } from '@/shared/api/queries/use-my-place-submissions'
import { useOnlineStatus } from '@/shared/api/queries/use-online-status'
import type { components } from '@/shared/api/types'
import { isSubmissionDetailRetryable, type MyPlaceSubmission } from '@/shared/api/endpoints/my-place-submissions'
import { useSession } from '@/shared/providers/session-provider'
import { EmptyState, ErrorState, LoadingState, OfflineState } from '@/shared/ui/async-state.view'
import { Atmosphere, GhostBtn, PrimaryBtn } from '@/shared/ui/primitives'
import { mapsUrlSchema } from '@/features/place-import/maps-url'
import { Text } from '@/shared/ui/text'
import { Chip } from '@/shared/ui/chip.view'
import { SegmentedTabs } from '@/shared/ui/segmented-tabs.view'
import { ContributionPlaceCard } from '@/shared/ui/contribution-place-card.view'
import { ContributionReviewCard } from '@/shared/ui/contribution-review-card.view'
import { ContributionCardSkeleton } from '@/shared/ui/contribution-card.view'
import { styles } from './my-contributions.style'

type Filter = 'all' | 'pending' | 'approved' | 'rejected' | 'removed'
type Review = components['schemas']['MyReview']
type Tab = 'places' | 'reviews'
const filters: Filter[] = ['all', 'pending', 'approved', 'rejected']
function matches(status: string, filter: Filter) {
  return filter === 'all' || status === filter || (filter === 'approved' && ['merged', 'published'].includes(status))
}
function dateLabel(value?: string, locale?: string) {
  const date = value ? new Date(value) : null
  if (!date || !Number.isFinite(date.getTime())) return null
  if (locale) return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

function ContributionPlace({ item }: { item: MyPlaceSubmission }) {
  const { t } = useTranslation()
  const router = useRouter()
  const canonical = item.status === 'approved' || item.status === 'merged'
  const detail = usePlaceDetail(canonical ? item.placeId : undefined)
  const online = useOnlineStatus()
  const needsHydration = !canonical && (item.providerStatus === 'deferred' || !item.name?.trim() || !item.addressShort?.trim())
  const submission = useMyPlaceSubmission(item, needsHydration && online)
  const display = !canonical && submission.data ? { ...item, ...submission.data } : item
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
  const progress = <>
    {needsHydration && submission.isFetching ? <LoadingState /> : null}
    {needsHydration && submission.isError ? <ErrorState error={submission.error} /> : null}
    {needsHydration && !submission.isFetching && !submission.isError && factsUnavailable ?
      <Text variant="caption" color="text.secondary">{t('contributions.detailsPending')}</Text> : null}
    {needsHydration && !submission.isFetching && canRetry ?
      <GhostBtn label={t('common.retry')} disabled={!online} onPress={() => { void submission.refetch() }} /> : null}
  </>
  const common = {
    status: item.status,
    submittedDate: dateLabel(item.createdAt),
    rejectionReason: item.rejectionReason ? t(`myContributions.rejection.${item.rejectionReason}`, { defaultValue: t('myContributions.rejection.other') }) : undefined,
    sourceUrl: url,
    onSupplement: url ? () => router.push({ pathname: '/places/import', params: { url } }) : undefined,
  }
  if (!canonical) return <ContributionPlaceCard {...common} preview={{
    name, address, googleRating: provider?.googleRating, googleRatingCount: provider?.googleRatingCount,
    photo: provider?.photo, attributions: provider?.attributions,
    googlePlaceId: provider?.photo?.url.match(/^\/v1\/places\/google-provider-photo\/([A-Za-z0-9_-]{5,255})$/)?.[1],
  }}>{progress}</ContributionPlaceCard>
  return <ContributionPlaceCard {...common} place={card}
    onPress={item.placeId ? () => router.push({ pathname: '/places/[placeId]', params: { placeId: item.placeId! } }) : undefined} />
}

function ContributionReview({ review }: { review: Review }) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const place = usePlaceDetail(review.placeId)
  const card = place.data ? detailToPlaceCard(place.data) : undefined
  const name = review.placeName ?? place.data?.name ?? review.planTitle ?? t(review.placeId ? 'myReviews.placeFallback' : 'review.subjectOverall')
  const address = review.placeAddressText ?? card?.addressText
  const date = dateLabel(review.createdAt, i18n.language)
  return <ContributionReviewCard review={review} name={name} address={address} thumbnail={card?.photoUrl} date={date}
    onOpenPlace={review.placeId ? () => router.push({ pathname: '/places/[placeId]', params: { placeId: review.placeId! } }) : undefined} />
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
  const options = [...(tab === 'places' ? filters : ['all', 'approved', 'pending', 'rejected'] as Filter[]), ...(tab === 'reviews' && reviewItems.some(row => row.status === 'removed') ? ['removed' as const] : [])]
  const loadMore = () => { if (query.hasNextPage && !query.isFetching && online) void query.fetchNextPage() }
  const emptyAction = <PrimaryBtn size="small" label={t(tab === 'places' ? 'contributions.emptyAdd' : 'contributions.explore')}
    onPress={() => router.push(tab === 'places' ? '/places/import' : '/places/search')} />
  const emptyTitle = filter === 'all' ? t(`contributions.empty.${tab}.title`) :
    t(`contributions.empty.${tab}.${filter}`)
  const emptyList = active.isPending ? (!online || active.isPaused ? <OfflineState /> : <><ContributionCardSkeleton kind={tab} /><ContributionCardSkeleton kind={tab} /></>) : active.isError ? null :
    tab === 'places' && query.hasNextPage ? <EmptyState title={t('myContributions.emptyTitle')} body={t('myContributions.noLoadedMatches')} action={emptyAction} /> :
      <View style={styles.empty}><View style={styles.emptyIcon}><MaterialIcon name={tab === 'places' ? 'location' : 'star'} size={20} color="text.secondary" /></View><Text variant="savedMeta" color="text.secondary" style={styles.emptyTitle}>{emptyTitle}</Text>{emptyAction}</View>
  const footer = <>
    {active.isError ? <ErrorState error={active.error} onRetry={() => { if (tab === 'places' && query.isFetchNextPageError) loadMore(); else void active.refetch() }} /> : null}
    {tab === 'places' && query.isFetchingNextPage ? <LoadingState /> : tab === 'places' && query.hasNextPage && !query.isError ? <GhostBtn label={t('myContributions.loadMore')} onPress={loadMore} disabled={!online} /> : null}
  </>
  const refresh = <RefreshControl refreshing={!!active.isRefetching && !(tab === 'places' && query.isFetchingNextPage)} onRefresh={() => { void active.refetch() }} />
  return <Atmosphere>
    <View><AppHeader showNotifications={false} title={t('myContributions.title')} onBack={() => router.back()}
      bellTestID="contributions-bell" unreadDotTestID="contributions-unread" /></View>
    {!registered ? <EmptyState title={t('notifications.signInTitle')} body={t('myContributions.signInBody')} action={<GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />} /> : <>
      <SegmentedTabs value={tab} onChange={value => { setTab(value); setFilter('all') }} options={[
        { value: 'places', label: t('contributions.places'), count: query.data == null ? undefined : `${items.length}${query.hasNextPage ? '+' : ''}` },
        { value: 'reviews', label: t('contributions.reviews'), count: reviews.data == null ? undefined : reviewItems.length },
      ]} />
      <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{options.map(value => {
        const label = tab === 'reviews' && value !== 'all' ? t(`contributions.reviewStatus.${value === 'approved' ? 'published' : value}`) : t(`myContributions.filter.${value}`)
        const fullLabel = active.data == null ? label : t('myReviews.filterChip', { label, count: `${statuses.filter(row => matches(row.status, value)).length}${tab === 'places' && query.hasNextPage ? '+' : ''}` })
        return <Chip key={value} label={fullLabel} variant={filter === value ? 'selected' : 'default'} onPress={() => setFilter(value)} />
      })}</ScrollView></View>
      {!online && !active.isPending ? <OfflineState /> : null}
      {tab === 'places' ? <FlatList testID="my-contributions-list" data={items.filter(item => matches(item.status, filter))} keyExtractor={item => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]} refreshControl={refresh} onEndReached={() => { if (!query.isError) loadMore() }} onEndReachedThreshold={0.3}
        ListEmptyComponent={emptyList} ListFooterComponent={footer} renderItem={({ item }) => <ContributionPlace item={item} />} /> :
        <FlatList testID="my-contributions-reviews" data={reviewItems.filter(item => matches(item.status, filter))} keyExtractor={item => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]} refreshControl={refresh} ListEmptyComponent={emptyList} ListFooterComponent={footer} renderItem={({ item }) => <ContributionReview review={item} />} />}
    </>}
    {registered && tab === 'places' ? <View style={styles.addAction}>
      <PrimaryBtn label={t('myContributions.add')} leadingIcon="plus" onPress={() => router.push('/places/import')} />
    </View> : null}
    {registered ? <AppTabDock active="profile" /> : null}
  </Atmosphere>
}
