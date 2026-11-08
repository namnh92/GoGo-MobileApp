import { View } from 'react-native'
import { CardImage, CardPrice, CardShell, CardTags, PlaceCardAddress, PlaceCardStatus, Verified, useCardData, type PlaceCardProps } from './place-card.view'
import { RatingChips } from './rating-chips.view'
import { Text } from './text'
import { styles } from './place-card-small.style'

/** Thumbnail-left common card; exported for the #561 map-marker branch. */
export function PlaceCardSmall(props: PlaceCardProps) {
  const data = useCardData(props)
  const { place } = data
  return <CardShell props={props} data={data} small style={styles.surface}>
    <View testID="place-card">
      <View testID="place-card-small" style={styles.row}>
        <View testID="place-card-photo" style={[styles.photo, props.unavailableLabel && styles.unavailablePhoto]}>
          <CardImage data={data} small />
          {props.contributionBadge || props.photoOverlay ? <View style={styles.featureOverlay}>{props.contributionBadge}{props.photoOverlay}</View> : null}
        </View>
        <View testID="place-card-body" style={[styles.body, (!!props.headerAction || props.saved != null && !!props.onToggleSave) && styles.withAction]}>
          {props.bodyLeading}
          <Text testID="place-card-name" variant="introLabel" color="redesign.ink" style={props.unavailableLabel ? styles.unavailableName : undefined} numberOfLines={1} ellipsizeMode="tail">{place.name}</Text>
          <PlaceCardAddress place={place} compact pin={false} />
          <RatingChips place={place} compact stacked />
          {place.discovery?.verified ? <Verified inline /> : null}
          <PlaceCardStatus place={place} label={data.statusLabel} inline />
          <CardPrice place={place} small />
          <CardTags place={place} tags={props.tags} categoryLabel={props.categoryLabel} />
          {props.headingAction}
          {props.unavailableLabel ? <Text variant="bodySmall" color="status.warningText">{props.unavailableLabel}</Text> : null}
          {props.bodyTrailing}
        </View>
      </View>
    </View>
  </CardShell>
}
export type { PlaceCardProps as PlaceCardSmallProps } from './place-card.view'
