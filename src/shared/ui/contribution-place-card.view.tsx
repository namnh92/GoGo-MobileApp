import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import type { MyPlaceSubmission } from '@/shared/api/endpoints/my-place-submissions'
import { Badge } from './badge.view'
import { ContributionCredits, ContributionReason } from './contribution-card.view'
import { styles as shared } from './contribution-card.style'
import { MaterialIcon } from './material-icon'
import { CardImage, useCardData, type PlaceCardProps } from './place-card.view'
import { RatingChips } from './rating-chips.view'
import { Text } from './text'
import { styles } from './contribution-place-card.style'

type Props = PlaceCardProps & {
  status: MyPlaceSubmission['status']
  submittedDate?: string | null
  rejectionReason?: string
  sourceUrl?: string
  onSupplement?: () => void
  children?: ReactNode
}

/** A contribution is a moderation record, with no saved-place or opening-hours controls. */
export function ContributionPlaceCard(props: Props) {
  const { t } = useTranslation()
  const data = useCardData(props)
  const { place } = data
  const { status } = props
  const Target = props.onPress ? Pressable : View
  return <View testID="contribution-place-card" style={[shared.surface, styles.card]}>
    <Target accessibilityRole={props.onPress ? 'button' : undefined} accessibilityLabel={props.onPress ? place.name : undefined} onPress={props.onPress}>
      <View testID="contribution-place-photo" style={styles.photo}><CardImage data={data} loadingSkeleton /><View testID="contribution-photo-header" style={styles.photoHeader}>
        <View testID="contribution-status" style={styles.badge}>
        <Badge appearance="solid" icon={status === 'pending' ? 'clock' : status === 'rejected' ? 'close' : 'checkCircle'}
          tone={status === 'pending' ? 'warning' : status === 'rejected' ? 'danger' : 'success'} label={t(`myContributions.status.${status}`)} />
        </View>
        {props.submittedDate ? <Text testID="contribution-submitted-date" variant="introCaption" color="onDark.strong" style={styles.date}>{t('myContributions.sentDate', { date: props.submittedDate })}</Text> : null}
      </View><ContributionCredits data={data} sourceUrl={props.sourceUrl} overlay /></View>
      <View style={styles.body}>
        <Text testID="place-card-name" variant="savedCardTitle" numberOfLines={1}>{place.name}</Text>
        {place.addressText ? <View style={styles.address}><MaterialIcon name="location" size={14} color="text.secondary" />
          <Text variant="avatarSubtitle" color="text.secondary" numberOfLines={1} style={shared.flex}>{place.addressText}</Text>
        </View> : null}
        <RatingChips place={place} />
      </View>
    </Target>
    <View style={styles.details}>
      {props.children}
      <ContributionReason reason={status === 'rejected' ? props.rejectionReason : undefined} />
      {status === 'rejected' ? <View style={styles.footer}><Pressable accessibilityRole="link" disabled={!props.onSupplement} accessibilityState={{ disabled: !props.onSupplement }}
        onPress={props.onSupplement} style={styles.supplement}><Text variant="savedMeta" color={props.onSupplement ? 'accent.primary' : 'text.secondary'}>{t('contributions.supplement')}</Text></Pressable></View> : null}
      {status === 'rejected' && !props.onSupplement ? <Text variant="introCaption" color="text.secondary">{t('contributions.linkUnavailable')}</Text> : null}
    </View>
  </View>
}
