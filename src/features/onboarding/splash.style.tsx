import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  root: {
    flex: 1,
    backgroundColor: theme.surface.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  /** One round card holds the mark, wordmark and tagline, as in the Stitch pair. */
  card: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: theme.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.toast,
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    alignItems: 'center',
  },
  wordmark: {
    letterSpacing: -0.5,
    marginTop: theme.spacing[3],
  },
  tagline: {
    marginTop: theme.spacing[1],
  },
}))
