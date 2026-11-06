import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { formatCount, formatRating, ratingParts, type PlaceCard } from '@/shared/api'

import { styles } from './rating-chips.style'
import { Text } from './text'

/**
 * The two rating sources side by side, never merged: Google, and GoGo only when
 * the API returns it. Nothing renders when neither exists (no placeholder).
 */
export function RatingChips({ place }: { place: Pick<PlaceCard, 'rating' | 'ratingCount' | 'ratingSource' | 'gogoRating' | 'gogoRatingCount'> }) {
  const { t, i18n } = useTranslation()
  const { google, gogo } = ratingParts(place)
  if (!google && !gogo) return null
  const chip = (source: 'google' | 'gogo', part: { value: number; count?: number }) => (
    <View key={source} style={[styles.chip, source === 'gogo' && styles.chipGogo]}>
      <Text variant="caption" color={source === 'gogo' ? 'status.infoText' : 'text.primary'}>
        ★ {formatRating(part.value, i18n.language)}
      </Text>
      {part.count != null ? (
        <Text variant="caption" color={source === 'gogo' ? 'status.infoText' : 'text.secondary'}>
          ({formatCount(part.count, i18n.language)})
        </Text>
      ) : null}
      <Text variant="caption" color={source === 'gogo' ? 'status.infoText' : 'text.primary'}>{t(`rating.${source}`)}</Text>
    </View>
  )
  return (
    <View style={styles.row}>
      {google ? chip('google', google) : null}
      {gogo ? chip('gogo', gogo) : null}
    </View>
  )
}
