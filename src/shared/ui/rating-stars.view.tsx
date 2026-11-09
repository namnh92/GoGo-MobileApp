import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { Icon } from './icons'
import { Text } from './text'
import { styles } from './rating-stars.style'

export function RatingStars({ rating }: { rating: number }) {
  const { t, i18n } = useTranslation()
  return <View style={styles.row} accessible accessibilityLabel={t('myReviews.yourRating', { count: rating })}>
    {[1, 2, 3, 4, 5].map(value => <Icon key={value} name="star" size={16} color={value <= rating ? 'status.warningText' : 'text.secondary'} filled={value <= rating} />)}
    <Text variant="savedMeta">{rating.toLocaleString(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</Text>
  </View>
}
