import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'
import { CardCredits, CardImage, CardShell, PlaceCardAddress, Verified, useCardData, type PlaceCardProps } from './place-card.view'
import { RatingChips } from './rating-chips.view'
import { Text } from './text'
import { Skeleton } from './skeleton.view'
import { Icon } from './icons'
import { touchTarget } from './tokens'
import { styles } from './place-card-small.style'

/** Thumbnail-left common card; exported for the #561 map-marker branch. */
export type PlaceCardSmallProps = PlaceCardProps & {
  /** Optional supporting content after the common facts. */
  caption?: ReactNode
  /** Move the shared photo credits to the final caption in the text column. */
  photoCaption?: boolean
  /** Seed/detail hydration keeps the known name and remove control available. */
  loading?: boolean
} & ({ onRemove: () => void; removeAccessibilityLabel: string } | { onRemove?: never; removeAccessibilityLabel?: never })

export function PlaceCardSmall(props: PlaceCardSmallProps) {
  const { t } = useTranslation()
  const data = useCardData(props)
  const { place } = data
  return <CardShell props={props} data={data} small showCredits={!props.photoCaption} style={styles.surface}
    surfaceAction={props.onRemove ? <Pressable testID="place-card-remove" accessibilityRole="button"
      accessibilityLabel={props.removeAccessibilityLabel} onPress={props.onRemove} style={styles.remove}
      // Extend inward: the shell clips hit areas outside its bounds.
      hitSlop={{ top: 0, right: 0, left: touchTarget.min - 32, bottom: touchTarget.min - 32 }}>
      <Icon name="x" size={18} color="text.primary" />
    </Pressable> : null}>
    <View testID="place-card">
      <View testID="place-card-small" style={styles.row}>
        <View testID="place-card-photo" style={[styles.photo, props.unavailableLabel && styles.unavailablePhoto]}>
          <CardImage data={data} small loadingSkeleton={props.loading} />
          {props.contributionBadge || props.photoOverlay ? <View style={styles.featureOverlay}>{props.contributionBadge}{props.photoOverlay}</View> : null}
          {place.discovery?.verified ? <Verified compact /> : null}
        </View>
        <View testID="place-card-body" style={[styles.body, props.onRemove && styles.withRemove]}>
          <Text testID="place-card-name" variant="introLabel" color="text.primary" style={[styles.name, (!!props.headerAction || props.saved != null && !!props.onToggleSave) && styles.withAction, props.unavailableLabel && styles.unavailableName]} numberOfLines={1} ellipsizeMode="tail">{place.name}</Text>
          {props.loading ? <View testID="place-card-small-loading" accessibilityRole="progressbar" accessibilityLabel={t('common.loading')}>
            <Skeleton width="100%" /><Skeleton width="60%" />
          </View> : <>
            <PlaceCardAddress place={place} compact />
            <RatingChips place={place} compact />
          </>}
          {props.caption}
          {props.photoCaption ? <CardCredits data={data} inline /> : null}
        </View>
      </View>
    </View>
  </CardShell>
}
