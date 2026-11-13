import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { discoveryLabels, detailToPlaceCard, useTaxonomies } from '@/shared/api'
import type { components } from '@/shared/api/types'
import { useMyPlaceSubmission } from '@/shared/api/queries/use-my-place-submissions'
import { useOnlineStatus } from '@/shared/api/queries/use-online-status'
import { isSubmissionDetailRetryable } from '@/shared/api/endpoints/my-place-submissions'
import { isApiError } from '@/shared/api/errors'
import { useSession } from '@/shared/providers/session-provider'
import { openWebsite } from '@/shared/navigation/external-links'
import { formatRange } from '@/shared/pricing/money'
import { type PriceUnit } from '@/shared/pricing/price-unit'
import { Atmosphere, Card, GhostBtn, SecondaryBtn } from '@/shared/ui/primitives'
import { Chip } from '@/shared/ui/chip.view'
import { Text } from '@/shared/ui/text'
import { MaterialIcon } from '@/shared/ui/material-icon'
import { PlacePhoto } from '@/shared/ui/place-photo.view'
import { StoredContributionCredits } from '@/shared/ui/contribution-card.view'
import { GoogleRatingBadge } from '@/shared/ui/rating-chips.view'
import { SubmissionHours } from '@/shared/ui/submission-facts.view'
import { Skeleton } from '@/shared/ui/skeleton.view'
import { EmptyState, ErrorState, OfflineState } from '@/shared/ui/async-state.view'
import { usePlaceClock } from '@/shared/ui/use-place-clock'
import { AppHeader } from '@/shared/ui/app-header.view'
import { styles } from './submission-detail.style'

type Detail = components['schemas']['MyPlaceSubmissionDetail']

export default function SubmissionDetailScreen() {
  const { t } = useTranslation()
  const { submissionId } = useLocalSearchParams<{ submissionId?: string }>()
  const router = useRouter()
  const online = useOnlineStatus()
  const registered = useSession().status === 'user'
  const query = useMyPlaceSubmission({ id: submissionId ?? '' }, registered && !!submissionId)
  const back = <AppHeader title={t('submissionDetail.title')} showNotifications={false} onBack={() => router.back()} />
  if (!registered) return <Atmosphere>{back}<EmptyState title={t('notifications.signInTitle')} body={t('myContributions.signInBody')} action={<GhostBtn label={t('auth.signInCta')} onPress={() => router.push('/auth/sign-in')} />} /></Atmosphere>
  if (!submissionId || (isApiError(query.error) && query.error.status === 404)) return <Atmosphere>{back}<EmptyState title={t('submissionDetail.notFound')} /></Atmosphere>
  if (query.isError && !query.data) return <Atmosphere>{back}{!online ? <OfflineState /> : <ErrorState error={query.error} onRetry={isSubmissionDetailRetryable(query.error) ? () => { void query.refetch() } : undefined} />}</Atmosphere>
  if (!query.data) return <Atmosphere>{back}{!online || query.isPaused ? <OfflineState /> : <ScrollView contentContainerStyle={styles.section} testID="submission-detail-loading" accessibilityRole="progressbar" accessibilityLabel={t('common.loading')}>
    <Skeleton width="100%" height={270} /><View style={styles.content}><Skeleton width="100%" height={92} /><Skeleton width="75%" height={28} /><Skeleton width="100%" height={100} /><Skeleton width="100%" height={300} /></View>
  </ScrollView>}</Atmosphere>
  return <SubmissionDetail data={query.data} />
}

function SubmissionDetail({ data }: { data: Detail }) {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const now = usePlaceClock()
  const online = useOnlineStatus()
  const taxonomy = useTaxonomies({ kinds: 'category,suitability,mood,amenity,checkin_tag' })
  const labels = discoveryLabels(taxonomy.data, i18n.language)
  const [allAmenities, setAllAmenities] = useState(false)
  const [failedPhoto, setFailedPhoto] = useState<string>()
  const rejected = data.status === 'rejected'
  const photoAllowed = !rejected || Date.parse(data.updateDeadline ?? '') > now.getTime()
  const photo = photoAllowed ? data.photo : undefined
  const unavailable = ['budget_exhausted', 'deferred'].includes(data.providerStatus ?? '')
  const provider = unavailable ? undefined : data.providerDisplay
  const name = data.name?.trim() || provider?.name?.trim()
  const address = data.addressShort?.trim() || provider?.addressShort?.trim()
  const card = detailToPlaceCard({ id: data.id, name: name ?? '', photos: photo ? [photo] : [] })
  const contribution = data.contribution
  const enrichment = contribution?.enrichment
  const price = enrichment?.price ?? contribution?.estimatedPrice
  const units: PriceUnit[] = ['per_person', 'per_group', 'per_item', 'per_hour', 'per_night', 'free']
  const unit = price && units.includes(price.unit as PriceUnit) ? price.unit as Exclude<PriceUnit, 'unknown'> : undefined
  const unitLabels = { per_person: t('price.unit.per_person'), per_group: t('price.unit.per_group'), per_item: t('price.unit.per_item'), per_hour: t('price.unit.per_hour'), per_night: t('price.unit.per_night'), free: t('price.unit.free') }
  const amount = unit === 'free' ? t('price.unit.free') : unit && price ? formatRange(price.min, price.max, price.currency) : undefined
  const priceText = amount ? unit === 'free' ? amount : `${amount} ${unitLabels[unit!]}` : undefined
  const selected = (kind: string, keys?: string[]) => [...new Set(keys ?? [])].flatMap(key => labels[kind]?.[key] ? [labels[kind]![key]!] : [])
  const purposes = selected('suitability', enrichment?.purposeKeys)
  const vibes = selected('mood', [...(contribution?.vibeKeys ?? []), ...(enrichment?.vibeKeys ?? [])])
  const amenities = selected('amenity', Object.keys(enrichment?.amenities ?? {}).filter(key => enrichment?.amenities?.[key] === true))
  const serviceRating = enrichment?.service?.rating
  const spaceRating = enrichment?.space?.rating
  const serviceChips = selected('checkin_tag', enrichment?.service?.chipKeys)
  const spaceChips = selected('checkin_tag', enrichment?.space?.chipKeys)
  const category = labels.category?.[data.categoryKey ?? contribution?.categoryKey ?? provider?.categoryKey ?? '']
  const experience = !!(enrichment?.service || enrichment?.space || enrichment?.recommendedDishes?.trim() || enrichment?.visitTips?.trim())
  const hasContribution = !!(priceText || purposes.length || vibes.length || amenities.length || experience || contribution?.note?.trim())
  const date = (value: string) => new Date(value).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })
  const bannerColor = rejected ? 'status.dangerText' : 'status.warningText'
  return <Atmosphere><ScrollView testID="submission-detail" contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}>
    <View style={styles.hero}>
      <PlacePhoto key={photo?.url ?? 'none'} uri={card.photoUrl} placeId={data.id} name={name} style={styles.photo} loadingSkeleton onPhotoError={() => setFailedPhoto(photo?.url)} />
      <AppHeader variant="hero" title={t('submissionDetail.title')} showNotifications={false} statusTone={rejected ? 'danger' : 'warning'} onBack={() => router.back()} />
      <View style={styles.photoFooter}>
        {photo && failedPhoto !== photo.url ? <View style={styles.credit}><StoredContributionCredits photo={photo} /></View> : null}
        {provider?.googleMapsUri ? <SecondaryBtn size="small" label={t('submissionDetail.maps')} style={styles.maps} onPress={() => { void openWebsite(provider.googleMapsUri!) }} /> : null}
      </View>
    </View>
    <View testID="submission-status-banner" style={[styles.banner, rejected && styles.rejected]}>
      <Text variant="title2" color={bannerColor}>{t(rejected ? 'myContributions.status.rejected' : 'submissionDetail.pending')}</Text>
      {rejected ? <>
        {data.rejectionReason ? <Text color={bannerColor}>{t(`myContributions.rejection.${data.rejectionReason}`)}</Text> : null}
        {data.updateDeadline ? <Text color={bannerColor}>{t('submissionDetail.deadline', { date: date(data.updateDeadline) })}</Text> : null}
      </> : <Text variant="bodySmall" color={bannerColor}>{t('submissionDetail.pendingBody', { date: date(data.createdAt) })}</Text>}
    </View>
    <View style={styles.content}>
      {!online ? <OfflineState /> : null}
      {unavailable ? <Text variant="bodySmall" color="text.secondary">{t('contributions.detailsPending')}</Text> : null}
      <View style={styles.section}>
        {category || address ? <View style={styles.row}>{category ? <Chip label={category} /> : null}{address ? <Text variant="bodySmall" color="text.secondary">{address}</Text> : null}</View> : null}
        {name ? <Text variant="title1">{name}</Text> : null}
        {provider?.googleRating != null || provider?.openingHours.length ? <View style={styles.row}>{provider?.googleRating != null ? <GoogleRatingBadge value={provider.googleRating} count={provider.googleRatingCount} detail /> : null}<SubmissionHours hours={provider?.openingHours} /></View> : null}
      </View>
      {address || provider?.openingHours.length ? <Card appearance="stitch" style={styles.section}>
        {address ? <Text variant="bodySmall">{address}</Text> : null}<SubmissionHours hours={provider?.openingHours} />
      </Card> : null}
      {provider?.attributions?.length ? <Text variant="caption" color="text.secondary">{[...new Set(provider.attributions)].join(' · ')}</Text> : null}
      {hasContribution ? <Card testID="submission-contribution" appearance="stitch" style={styles.section}>
        <View style={styles.row}><Text variant="title2" color="accent.primary">{t('submissionDetail.added')}</Text><Chip label={t('submissionDetail.personal')} /></View>
        {priceText || purposes.length ? <View style={styles.tiles}>
          {priceText ? <View style={[styles.tile, styles.priceTile]}><Text variant="caption" color="text.secondary">{t('submissionDetail.price')}</Text><Text color="accent.primary">{priceText}</Text></View> : null}
          {purposes.length ? <View style={[styles.tile, styles.priceTile]}><Text variant="caption" color="text.secondary">{t('submissionDetail.purposes')}</Text>{purposes.map(label => <Text key={label}>{label}</Text>)}</View> : null}
        </View> : null}
        {vibes.length ? <View style={styles.section}><Text variant="bodySmall">{t('submissionDetail.vibes')}</Text><View style={styles.chips}>{vibes.map(label => <Chip key={label} label={`✓ ${label}`} />)}</View></View> : null}
        {amenities.length ? <View style={styles.section}><Text variant="bodySmall">{t('submissionDetail.amenities')}</Text>{(allAmenities ? amenities : amenities.slice(0, 5)).map(label => <View key={label} style={styles.row}><MaterialIcon name="checkCircle" size={18} color="status.successText" /><Text variant="bodySmall">{label}</Text></View>)}
          {amenities.length > 5 ? <GhostBtn label={t(allAmenities ? 'submissionDetail.less' : 'submissionDetail.all')} onPress={() => setAllAmenities(!allAmenities)} /> : null}
        </View> : null}
        {experience ? <View testID="submission-experience" style={styles.tile}>
          {enrichment?.service ? <><Text>{t('submissionDetail.service', { rating: serviceRating })}</Text>{serviceChips.length ? <View style={styles.chips}>{serviceChips.map(label => <Chip key={label} label={label} />)}</View> : null}</> : null}
          {enrichment?.space ? <><Text>{t('submissionDetail.space', { rating: spaceRating })}</Text>{spaceChips.length ? <View style={styles.chips}>{spaceChips.map(label => <Chip key={label} label={label} />)}</View> : null}</> : null}
          {enrichment?.recommendedDishes?.trim() ? <><Text variant="bodySmall">{t('submissionDetail.dishes')}</Text><Text style={styles.quote}>{t('submissionDetail.quote', { text: enrichment.recommendedDishes })}</Text></> : null}
          {enrichment?.visitTips?.trim() ? <><Text variant="bodySmall">{t('submissionDetail.tips')}</Text><Text style={styles.quote}>{t('submissionDetail.quote', { text: enrichment.visitTips })}</Text></> : null}
        </View> : null}
        {contribution?.note?.trim() ? <Text style={styles.quote}>{t('submissionDetail.quote', { text: contribution.note })}</Text> : null}
      </Card> : null}
      <Text variant="caption" color="text.secondary" style={styles.footer}>{t('submissionDetail.footer')}</Text>
    </View>
  </ScrollView></Atmosphere>
}
