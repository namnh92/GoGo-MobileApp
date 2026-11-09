import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  list: { paddingHorizontal: 16, paddingTop: 10, gap: 16, flexGrow: 1 },
  filters: { gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  filterTarget: { minHeight: 44, justifyContent: 'center' },
  chip: { borderRadius: 99, borderWidth: 1, borderColor: theme.border.hairline, backgroundColor: theme.surface.card, paddingHorizontal: 14, paddingVertical: 6 },
  chipSelected: { backgroundColor: theme.text.primary, borderColor: theme.text.primary },
  addAction: { paddingHorizontal: 16, paddingVertical: 12 },
  empty: { marginTop: 14, padding: 16, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.border.hairline, backgroundColor: theme.surface.subtle, alignItems: 'center', gap: 10 },
  emptyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.border.hairline, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { textAlign: 'center' },
}))
