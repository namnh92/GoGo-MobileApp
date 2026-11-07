import { StyleSheet } from 'react-native-unistyles'
import type { AppTheme } from './theme'

/** Google tile styling uses opaque colors; alpha washes are for RN surfaces. */
export function googleMapStyle(map: AppTheme['map']) {
  return [
    { elementType: 'geometry', stylers: [{ color: map.canvas }] },
    { elementType: 'labels.text.fill', stylers: [{ color: map.label }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: map.labelStroke }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: map.roadFill }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: map.water }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: map.park }] },
  ]
}

export const styles = StyleSheet.create(theme => ({
  fallback: { backgroundColor: theme.map.canvas },
  canvas: { backgroundColor: theme.map.canvas },
  callout: {
    backgroundColor: theme.surface.card,
    borderColor: theme.border.hairline,
    borderWidth: 1,
    borderRadius: theme.radius.compact,
    padding: theme.spacing[2],
    maxWidth: 240,
  },
}))
