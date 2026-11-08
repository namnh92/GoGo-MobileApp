import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 16, flexGrow: 1 },
  filters: { gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  pressed: { borderColor: theme.accent.primary, borderWidth: 1 },
  unavailable: { opacity: 0.65 },
  bookmark: { width: 44, height: 44, borderRadius: 99, backgroundColor: theme.surface.card, alignItems: 'center', justifyContent: 'center' },
  metadata: { borderTopWidth: 1, borderTopColor: theme.border.hairline, paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rejection: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.status.dangerSoft, borderRadius: 12, padding: 12 },
  linkTarget: { minHeight: 44, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  reviewCard: { padding: 16, gap: 12, borderRadius: 16, backgroundColor: theme.surface.card, borderWidth: 1, borderColor: theme.border.hairline, ...theme.shadows.card },
  reviewPhoto: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden' },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6 },
  fab: {
    position: 'absolute', right: 20, width: 56, height: 56,
    borderRadius: theme.radius.pill, backgroundColor: theme.accent.primary,
    alignItems: 'center', justifyContent: 'center', ...theme.shadows.cta,
  },
  fabPressed: { backgroundColor: theme.accent.pressed },
}))
