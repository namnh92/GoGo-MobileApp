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
  markerHost: { width: 44, height: 50, alignItems: 'center', justifyContent: 'flex-end' },
  markerHostSelected: { width: 52, height: 58 },
  markerBubble: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.map.labelStroke, borderColor: theme.map.label,
  },
  markerSelected: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: theme.accent.primary, borderColor: theme.accent.primary,
  },
  markerTip: {
    width: 10, height: 10, marginTop: -6, marginBottom: 3,
    transform: [{ rotate: '45deg' }], backgroundColor: theme.map.label,
  },
  markerTipSelected: { backgroundColor: theme.accent.primary },
  callout: {
    backgroundColor: theme.surface.card,
    borderColor: theme.border.hairline,
    borderWidth: 1,
    borderRadius: theme.radius.compact,
    padding: theme.spacing[2],
    maxWidth: 240,
  },
}))
