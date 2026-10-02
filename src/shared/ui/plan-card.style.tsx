import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[3] },
  /** Past plans stay readable, just clearly behind the live ones. */
  past: { opacity: 0.72 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.soft,
  },
  iconPast: { backgroundColor: theme.surface.subtle },
  // `minWidth: 0` so a long title wraps inside the column instead of
  // widening the card. The column holds title, meta and status, so its width
  // is the row minus the icon — nothing beside it competes for the space.
  body: { flex: 1, minWidth: 0, gap: 2 },
  /** Hugs its label; a little air above so it reads as its own row. */
  status: { alignSelf: 'flex-start', marginTop: theme.spacing[1] },
}))
