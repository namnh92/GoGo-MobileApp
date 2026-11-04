import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing[3] },
  /**
   * Past plans sit behind the live ones by surface, not by fading (#382): an
   * opacity multiplied into every label and took `text.secondary` under AA.
   * On the canvas tone with a hairline and no shadow, the meta still measures
   * 4.55:1.
   */
  past: {
    backgroundColor: theme.surface.canvas,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    shadowOpacity: 0,
    elevation: 0,
  },
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
  /** Hugs its label and leads the column, above the title. */
  status: { alignSelf: 'flex-start', marginBottom: theme.spacing[1] },
}))
