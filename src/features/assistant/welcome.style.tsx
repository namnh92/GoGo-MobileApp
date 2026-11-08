import { StyleSheet } from 'react-native-unistyles'

/**
 * Welcome: a soft hero (avatar, greeting, one line) over a labelled stack of
 * the four starting points, full width, one per row.
 */
export const styles = StyleSheet.create(theme => ({
  body: { paddingHorizontal: theme.spacing[4], paddingTop: theme.spacing[4], paddingBottom: theme.spacing[5], gap: theme.spacing[4] },
  hero: {
    alignItems: 'center',
    gap: theme.spacing[3],
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[4],
  },
  avatar: { width: 80, height: 80, borderRadius: theme.radius.pill, borderWidth: 3, borderColor: theme.accent.primary, backgroundColor: theme.surface.card, alignItems: 'center', justifyContent: 'center', ...theme.shadows.card },
  section: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], paddingTop: theme.spacing[2] },
  sectionTitle: { flex: 1 },
  centered: { textAlign: 'center' },
  sectionLabel: { paddingTop: theme.spacing[2] },
  list: { gap: theme.spacing[4] },
}))
