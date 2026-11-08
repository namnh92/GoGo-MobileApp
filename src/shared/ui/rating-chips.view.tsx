import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { formatCount, formatRating, ratingParts, type PlaceCard } from '@/shared/api'

import { styles } from './rating-chips.style'
import { Text } from './text'

/**
 * Independent rating sources. Small cards keep GoGo above Google, including
 * community wording before enough reviews exist. Other surfaces omit absent data.
 */
type RatingPlace = Pick<PlaceCard, 'rating' | 'ratingCount' | 'ratingSource' | 'gogoRating' | 'gogoRatingCount'>

export function RatingChips({ place, compact = false, detail = false, stacked = false }: { place: RatingPlace; compact?: boolean; detail?: boolean; stacked?: boolean }) {
  const { google, gogo } = ratingParts(place)
  if (!compact && !google && !gogo && place.gogoRatingCount == null) return null
  return <View testID="place-card-ratings" style={[styles.row, compact && styles.compactRow, stacked && styles.stackedRow]}>
    {compact ? <GoGoRatingBadge place={place} compact /> : null}
    {google ? <GoogleRatingBadge value={google.value} count={google.count} compact={compact} detail={detail} /> : null}
    {!compact ? <GoGoRatingBadge place={place} detail={detail} /> : null}
  </View>
}

export function GoGoRatingBadge({ place, compact = false, detail = false }: { place: RatingPlace; compact?: boolean; detail?: boolean }) {
  const { t, i18n } = useTranslation()
  const { gogo } = ratingParts(place)
  if (!compact && !gogo && place.gogoRatingCount == null) return null
  return <View testID="place-gogo-rating" style={[styles.gogo, compact && styles.compactBadge, detail && styles.detailBadge]}>
    <Text numberOfLines={compact ? undefined : 1} ellipsizeMode={compact ? undefined : 'tail'} variant="introCaptionMedium" color="redesign.violetText">{gogo
      ? t('discovery.gogoRating', { score: formatRating(gogo.value, i18n.language), count: formatCount(gogo.count!, i18n.language) })
      : `${t('discovery.gogoFewReviews')}${place.gogoRatingCount == null ? '' : ` (${formatCount(place.gogoRatingCount, i18n.language)})`}`}</Text>
  </View>
}

export function GoogleRatingBadge({ value, count, compact = false, detail = false }: { value: number; count?: number; compact?: boolean; detail?: boolean }) {
  const { t, i18n } = useTranslation()
  const label = t('discovery.googleRating', {
    score: formatRating(value, i18n.language),
    count: count == null ? '' : `(${formatCount(count, i18n.language)})`,
  }).replace(/\s+/g, ' ')
  return <View testID="place-google-rating" style={[styles.google, compact && styles.compactBadge, detail && styles.detailBadge, detail && styles.detailGoogle]}>
    <Text numberOfLines={compact ? undefined : 1} ellipsizeMode={compact ? undefined : 'tail'} variant="introCaptionMedium" color="redesign.ink" accessibilityLabel={label}><Text variant="introCaptionMedium" color="status.warningText">★</Text>{label.slice(1)}</Text>
  </View>
}
