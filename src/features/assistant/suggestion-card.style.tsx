import { StyleSheet } from 'react-native-unistyles'

/** Solid card, `radius-card`, `shadow-card`, `space-4` inside, 132pt tall at least. */
export const styles = StyleSheet.create(theme => ({
  card: {
    flex: 1,
    minHeight: 132,
    gap: theme.spacing[2],
    padding: theme.spacing[4],
    borderRadius: theme.radius.card,
    backgroundColor: theme.surface.card,
    ...theme.shadows.card,
  },
  cardPressed: { backgroundColor: theme.surface.subtle },
  tile: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.compact,
    backgroundColor: theme.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing[1],
  },
}))
