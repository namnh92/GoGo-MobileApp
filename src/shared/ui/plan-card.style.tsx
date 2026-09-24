import { StyleSheet } from 'react-native-unistyles'

import { glyph } from '@/shared/ui/tokens'

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
  glyph: { fontSize: glyph.sm },
  // `minWidth: 0` so a long title wraps inside the column instead of pushing
  // the status chip off the card.
  body: { flex: 1, minWidth: 0, gap: 2 },
  status: { alignSelf: 'flex-start' },
}))
