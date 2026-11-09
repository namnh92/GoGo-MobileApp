import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  surface: { borderRadius: theme.radius.card },
  unavailablePhoto: { opacity: 0.5 },
  photo: { aspectRatio: 1.6, backgroundColor: theme.redesign.container },
  photoFooter: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  featureOverlay: { position: 'absolute', top: 52, left: 12, right: 60 },
  body: { minWidth: 0, padding: theme.spacing[4], gap: theme.spacing[2] },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[2] },
  name: { flex: 1, minWidth: 0 },
  unavailableName: { textDecorationLine: 'line-through' },
}))
