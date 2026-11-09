import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import type { components } from '@/shared/api/types'
import { Badge } from './badge.view'
import { ContributionReason } from './contribution-card.view'
import { styles as shared } from './contribution-card.style'
import { PlacePhoto } from './place-photo.view'
import { RatingStars } from './rating-stars.view'
import { Text } from './text'
import { styles } from './contribution-review-card.style'

type Props = {
  review: components['schemas']['MyReview']
  name: string
  address?: string | null
  thumbnail?: string | null
  date?: string | null
  onOpenPlace?: () => void
  /** User attachments only. The current /me/reviews contract does not expose these yet. */
  photos?: readonly { url: string }[]
}

export function ContributionReviewCard({ review, name, address, thumbnail, date, onOpenPlace, photos = [] }: Props) {
  const { t } = useTranslation()
  const tone = review.status === 'published' ? 'success' : review.status === 'pending' ? 'warning' : 'danger'
  const Target = onOpenPlace ? Pressable : View
  return <Target testID="contribution-review-card" style={[shared.surface, styles.card]}
    accessibilityRole={onOpenPlace ? 'button' : undefined} accessibilityLabel={onOpenPlace ? name : undefined} onPress={onOpenPlace}>
    <View style={styles.header}>
      <View style={styles.identity}>
        {review.placeId ? <PlacePhoto placeId={review.placeId} name={name} uri={thumbnail} style={styles.thumbnail} /> : null}
        <View style={styles.name}><Text variant="avatarPrimary" numberOfLines={2}>{name}</Text>
          {address ? <Text variant="avatarSubtitle" color="text.secondary" numberOfLines={1}>{address}</Text> : null}
        </View>
      </View>
      <Badge style={styles.badge} tone={tone} icon={review.status === 'published' ? 'checkCircle' : review.status === 'pending' ? 'clock' : 'close'} label={t(`contributions.reviewStatus.${review.status}`)} />
    </View>
    <View style={styles.meta}><RatingStars rating={review.rating} />{date ? <Text variant="avatarSubtitle" color="text.secondary">{date}</Text> : null}</View>
    {review.text ? <Text variant="avatarSubtitle" color="text.secondary" numberOfLines={2} style={styles.text}>{review.text}</Text> : null}
    {photos.length ? <View testID="contribution-review-photos" style={styles.photos}>{photos.slice(0, 3).map((photo, index) => <View key={`${index}-${photo.url}`} style={styles.photo}>
      <PlacePhoto placeId={review.id} uri={photo.url} accessibilityLabel={t('contributions.reviewPhoto', { index: index + 1 })} style={styles.photo} />
      {index === 2 && photos.length > 3 ? <View style={styles.overflow}><Text variant="savedMeta" color="onDark.strong">{t('contributions.morePhotos', { count: photos.length - 3 })}</Text></View> : null}
    </View>)}</View> : null}
    <ContributionReason reason={review.status === 'rejected' ? review.rejectionReason : undefined} />
  </Target>
}
