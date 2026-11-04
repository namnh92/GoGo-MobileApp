import { StyleSheet } from 'react-native-unistyles'

/** Solid card (#295): `radius-card`, `shadow-card`, `space-4` inside. */
export const styles = StyleSheet.create(theme => ({
  card: {
    gap: theme.spacing[3],
    padding: theme.spacing[4],
    borderRadius: theme.radius.card,
    backgroundColor: theme.surface.card,
    ...theme.shadows.card,
  },
  head: { flexDirection: 'row', gap: theme.spacing[3], alignItems: 'center' },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.compact,
    backgroundColor: theme.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, minWidth: 0 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  metaText: { flexShrink: 1 },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[1],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.radius.pill,
    backgroundColor: theme.status.infoSoft,
  },
  badges: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] },
}))
