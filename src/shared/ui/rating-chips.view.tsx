import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { formatCount, formatRating, ratingParts, type PlaceCard } from '@/shared/api'

import { styles } from './rating-chips.style'
import { Chip } from './chip.view'

/**
 * The two rating sources side by side, never merged: Google, and GoGo only when
 * the API returns it. Nothing renders when neither exists (no placeholder).
 */
export function RatingChips({ place, source }: { source?: 'gogo'; place: Pick<PlaceCard, 'rating' | 'ratingCount' | 'ratingSource' | 'gogoRating' | 'gogoRatingCount'> }) {
  const { t, i18n } = useTranslation()
  const { google, gogo } = ratingParts(place)
  if ((!google || source === 'gogo') && !gogo) return null
  const chip = (source: 'google' | 'gogo', part: { value: number; count?: number }) => {
    const label = t(source === 'google' ? 'discovery.googleRating' : 'rating.gogoScore', {
      score: formatRating(part.value, i18n.language),
      count: part.count == null ? '' : `(${formatCount(part.count, i18n.language)})`,
    }).replace(/\s+/g, ' ')
    return <Chip key={source} label={label} variant={source === 'gogo' ? 'info' : 'default'} />
  }
  return (
    <View style={styles.row}>
      {google && !source ? chip('google', google) : null}
      {gogo ? chip('gogo', gogo) : null}
    </View>
  )
}
