import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  stitch: { backgroundColor: theme.surface.card, borderRadius: 16 },
  stitchLow: { backgroundColor: theme.surface.low, borderRadius: 12 },
  card: {
    backgroundColor: theme.surface.card,
    borderRadius: theme.radius.card,
    ...theme.shadows.card,
  },
  padded: { padding: theme.spacing[4] },
}))
