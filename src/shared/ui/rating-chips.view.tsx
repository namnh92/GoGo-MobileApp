import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { formatCount, formatRating, ratingParts, type PlaceCard } from '@/shared/api'

import { styles } from './rating-chips.style'
import { Text } from './text'

/**
 * Independent rating sources. Small cards keep GoGo above Google, including
 * community wording when a known count is below threshold. Absent data is omitted.
 */
type RatingPlace = Pick<PlaceCard, 'rating' | 'ratingCount' | 'ratingSource' | 'gogoRating' | 'gogoRatingCount'>

export function RatingChips({ place, compact = false, detail = false, stacked = false }: { place: RatingPlace; compact?: boolean; detail?: boolean; stacked?: boolean }) {
  const { google, gogo } = ratingParts(place)
  if (!google && !gogo && place.gogoRatingCount == null) return null
  return <View testID="place-card-ratings" style={[styles.row, compact && styles.compactRow, stacked && styles.stackedRow]}>
    {compact ? <GoGoRatingBadge place={place} compact /> : null}
    {google ? <GoogleRatingBadge value={google.value} count={google.count} compact={compact} detail={detail} /> : null}
    {!compact ? <GoGoRatingBadge place={place} detail={detail} /> : null}
  </View>
}

export function GoGoRatingBadge({ place, compact = false, detail = false }: { place: RatingPlace; compact?: boolean; detail?: boolean }) {
  const { t, i18n } = useTranslation()
  const { gogo } = ratingParts(place)
  if (!gogo && place.gogoRatingCount == null) return null
  const count = formatCount(gogo?.count ?? place.gogoRatingCount!, i18n.language)
  const score = gogo ? formatRating(gogo.value, i18n.language) : null
  const status = compact
    ? t('discovery.gogoFewReviewsCompact', { count: place.gogoRatingCount })
    : t('discovery.gogoFewReviewsStatus')
  const label = gogo
    ? t('discovery.gogoRating', { score, count })
    : compact ? `GoGo · ${count} ${status}` : `${t('discovery.gogoFewReviews')} (${count})`
  return <View testID="place-gogo-rating" accessible accessibilityLabel={label} style={[styles.gogo, styles.badgeRow, compact && styles.compactBadge, detail && styles.detailBadge]}>
    {gogo ? <>
      <Text testID="place-gogo-rating-score" style={styles.fact} variant="introCaptionMedium" color="status.infoText">★ {score} </Text>
      <Text testID="place-gogo-rating-count" style={styles.fact} variant="introCaptionMedium" color="status.infoText">({count}) </Text>
      <Text testID="place-gogo-rating-source" style={styles.fact} variant="introCaptionMedium" color="status.infoText">GoGo</Text>
    </> : <>
      <Text testID="place-gogo-rating-source" style={styles.fact} variant="introCaptionMedium" color="status.infoText">GoGo · </Text>
      {compact ? <Text testID="place-gogo-rating-count" style={styles.fact} variant="introCaptionMedium" color="status.infoText">{count} </Text> : null}
      <Text testID="place-gogo-rating-status" numberOfLines={1} ellipsizeMode="tail" style={styles.status} variant="introCaptionMedium" color="status.infoText">{status}</Text>
      {!compact ? <Text testID="place-gogo-rating-count" style={styles.fact} variant="introCaptionMedium" color="status.infoText"> ({count})</Text> : null}
    </>}
  </View>
}

export function GoogleRatingBadge({ value, count, compact = false, detail = false }: { value: number; count?: number; compact?: boolean; detail?: boolean }) {
  const { t, i18n } = useTranslation()
  const label = t('discovery.googleRating', {
    score: formatRating(value, i18n.language),
    count: count == null ? '' : `(${formatCount(count, i18n.language)})`,
  }).replace(/\s+/g, ' ')
  return <View testID="place-google-rating" accessible accessibilityLabel={label} style={[styles.google, styles.badgeRow, compact && styles.compactBadge, detail && styles.detailBadge, detail && styles.detailGoogle]}>
    <Text testID="place-google-rating-score" style={styles.fact} variant="introCaptionMedium" color="text.primary"><Text style={styles.fact} variant="introCaptionMedium" color="status.warningText">★</Text> {formatRating(value, i18n.language)} </Text>
    {count != null ? <Text testID="place-google-rating-count" style={styles.fact} variant="introCaptionMedium" color="text.primary">({formatCount(count, i18n.language)}) </Text> : null}
    <Text testID="place-google-rating-source" style={styles.fact} variant="introCaptionMedium" color="text.primary">Google</Text>
  </View>
}
