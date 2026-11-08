import { View } from 'react-native'
import { CardImage, CardPrice, CardShell, CardTags, PlaceCardAddress, PlaceCardStatus, Verified, useCardData, type PlaceCardProps } from './place-card.view'
import { RatingChips } from './rating-chips.view'
import { Text } from './text'
import { styles } from './place-card-large.style'

/** Canonical full-width place card: Home, Explore and every full-width place list. */
export function PlaceCardLarge(props: PlaceCardProps) {
  const data = useCardData(props)
  const { place } = data
  return <CardShell props={props} data={data} style={styles.surface}>
    <View testID="place-card">
      <View testID="place-card-large">
        <View testID="place-card-photo" style={[styles.photo, props.unavailableLabel && styles.unavailablePhoto]}>
          <CardImage data={data} />
          {place.discovery?.verified ? <Verified /> : null}
          {props.contributionBadge || props.photoOverlay ? <View style={styles.featureOverlay}>{props.contributionBadge}{props.photoOverlay}</View> : null}
          <View testID="place-card-photo-footer" style={styles.photoFooter}><PlaceCardStatus place={place} label={data.statusLabel} /></View>
        </View>
        <View testID="place-card-body" style={styles.body}>
          {props.bodyLeading}
          <View testID="place-card-title-row" style={styles.titleRow}>
            <Text testID="place-card-name" variant="discoveryHeading" color="redesign.ink" style={[styles.name, props.unavailableLabel && styles.unavailableName]} numberOfLines={1} ellipsizeMode="tail">{place.name}</Text>
            <CardPrice place={place} />{props.headingAction}
          </View>
          <PlaceCardAddress place={place} />
          <RatingChips place={place} />
          <CardTags place={place} tags={props.tags} categoryLabel={props.categoryLabel} />
          {props.unavailableLabel ? <Text variant="bodySmall" color="status.warningText">{props.unavailableLabel}</Text> : null}
          {props.bodyTrailing}
        </View>
      </View>
    </View>
  </CardShell>
}
export type { PlaceCardProps as PlaceCardLargeProps } from './place-card.view'
