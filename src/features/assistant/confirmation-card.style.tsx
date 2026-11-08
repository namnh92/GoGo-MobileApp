import { StyleSheet } from 'react-native-unistyles'

/**
 * The proposal card: a tinted head band (kicker + title) over a body of the
 * facts and the two buttons, an accent edge on top. Solid, clipped to the card.
 */
export const styles = StyleSheet.create(theme => ({
  card: {
    overflow: 'hidden',
    borderRadius: theme.radius.card,
    borderTopWidth: 4,
    borderTopColor: theme.accent.primary,
    backgroundColor: theme.surface.card,
    ...theme.shadows.card,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
    padding: theme.spacing[4],
    backgroundColor: theme.accent.soft,
  },
  body: { gap: theme.spacing[4], padding: theme.spacing[4] },
  tile: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, minWidth: 0 },
  actions: { gap: theme.spacing[2] },
  outcome: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  outcomeText: { flexShrink: 1 },
}))
