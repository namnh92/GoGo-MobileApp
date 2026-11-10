import type { ReactNode } from 'react'
import { View } from 'react-native'
import { CardCredits, CardImage, CardPrice, CardShell, PlaceCardAddress, PlaceCardStatus, Verified, useCardData, type PlaceCardProps } from './place-card.view'
import { RatingChips } from './rating-chips.view'
import { Text } from './text'
import { styles } from './place-card-small.style'

/** Thumbnail-left common card; exported for the #561 map-marker branch. */
export type PlaceCardSmallProps = PlaceCardProps & {
  /** Optional supporting content after the common facts. */
  caption?: ReactNode
  /** Move the shared photo credits to the final caption in the text column. */
  photoCaption?: boolean
  /** Optional verified facts for compact results that include price and hours. */
  showPrice?: boolean
  showStatus?: boolean
  /** Omit the community placeholder when the response has no rating facts. */
  hideMissingRating?: boolean
}

export function PlaceCardSmall(props: PlaceCardSmallProps) {
  const data = useCardData(props)
  const { place } = data
  return <CardShell props={props} data={data} small showCredits={!props.photoCaption} style={styles.surface}>
    <View testID="place-card">
      <View testID="place-card-small" style={styles.row}>
        <View testID="place-card-photo" style={[styles.photo, props.unavailableLabel && styles.unavailablePhoto]}>
          <CardImage data={data} small />
          {props.contributionBadge || props.photoOverlay ? <View style={styles.featureOverlay}>{props.contributionBadge}{props.photoOverlay}</View> : null}
          {place.discovery?.verified ? <Verified compact /> : null}
        </View>
        <View testID="place-card-body" style={styles.body}>
          <Text testID="place-card-name" variant="introLabel" color="text.primary" style={[styles.name, (!!props.headerAction || props.saved != null && !!props.onToggleSave) && styles.withAction, props.unavailableLabel && styles.unavailableName]} numberOfLines={1} ellipsizeMode="tail">{place.name}</Text>
          <PlaceCardAddress place={place} compact />
          {!props.hideMissingRating || place.gogoRatingCount != null || place.gogoRating != null || place.rating != null ? <RatingChips place={place} compact /> : null}
          {props.showPrice ? <CardPrice place={place} small /> : null}
          {props.showStatus ? <PlaceCardStatus place={place} inline label={data.statusLabel} /> : null}
          {props.caption}
          {props.photoCaption ? <CardCredits data={data} inline /> : null}
        </View>
      </View>
    </View>
  </CardShell>
}
