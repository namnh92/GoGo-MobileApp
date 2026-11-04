import { StyleSheet } from 'react-native-unistyles'

/** One solid card at the top of the canvas: padlocked avatar, title, reason, the button. */
export const styles = StyleSheet.create(theme => ({
  body: { flex: 1, paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[4] },
  card: {
    alignItems: 'center',
    gap: theme.spacing[3],
    padding: theme.spacing[5],
    borderRadius: theme.radius.hero,
    backgroundColor: theme.surface.card,
    ...theme.shadows.card,
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.status.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lock: {
    position: 'absolute',
    right: 0,
    bottom: 4,
    width: 32,
    height: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: { textAlign: 'center' },
  cta: { alignSelf: 'stretch', marginTop: theme.spacing[2] },
}))
