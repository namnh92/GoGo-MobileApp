import { StyleSheet } from 'react-native-unistyles'

/** One solid card at the top of the canvas: padlocked avatar, title, reason, the button. */
export const styles = StyleSheet.create(theme => ({
  body: { flexGrow: 1, paddingHorizontal: theme.spacing[4], paddingVertical: theme.spacing[4], gap: theme.spacing[4] },
  card: {
    alignItems: 'center',
    gap: theme.spacing[5],
    padding: theme.spacing[6],
    borderRadius: theme.radius.hero,
    backgroundColor: theme.surface.card,
    ...theme.shadows.card,
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accent.soft,
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
  benefits: { alignSelf: 'stretch', padding: theme.spacing[4], gap: theme.spacing[3], borderRadius: theme.radius.card, backgroundColor: theme.surface.subtle },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  benefitText: { flex: 1 },
  lockedDock: { padding: theme.spacing[4], gap: theme.spacing[2], borderRadius: theme.radius.hero, backgroundColor: theme.surface.subtle },
  lockedField: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], padding: theme.spacing[3], borderRadius: theme.radius.card, backgroundColor: theme.surface.card },
  cta: { alignSelf: 'stretch', marginTop: theme.spacing[2] },
}))
