import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  card: {
    gap: theme.spacing[4],
    padding: theme.spacing[4],
    borderRadius: theme.radius.card,
    backgroundColor: theme.surface.card,
    ...theme.shadows.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] },
  tile: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.compact,
    backgroundColor: theme.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, minWidth: 0 },
  actions: { gap: theme.spacing[2] },
  outcome: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  outcomeText: { flexShrink: 1 },
}))
