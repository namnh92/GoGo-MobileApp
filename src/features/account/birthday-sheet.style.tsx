import { StyleSheet } from 'react-native-unistyles'

export const BIRTHDAY_ROW_HEIGHT = 44

export const styles = StyleSheet.create(theme => ({
  content: { gap: 14 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: theme.border.hairline },
  headingCopy: { flex: 1, gap: 2 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface.card, borderWidth: 0 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 0, backgroundColor: theme.surface.subtle },
  picker: { padding: 12, borderRadius: 16, borderWidth: 0, backgroundColor: theme.surface.card },
  columns: { flexDirection: 'row', gap: 8 },
  column: { flex: 1, gap: 8 },
  columnLabel: { textAlign: 'center' },
  wheel: { height: BIRTHDAY_ROW_HEIGHT * 3, overflow: 'hidden' },
  wheelPadding: { paddingVertical: BIRTHDAY_ROW_HEIGHT },
  row: { height: BIRTHDAY_ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: theme.surface.subtle, borderRadius: 8 },
  shortcuts: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6, paddingTop: 8, marginTop: 8, borderTopWidth: 1, borderTopColor: theme.border.hairline },
  shortcut: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.surface.subtle, borderRadius: 8, borderWidth: 0 },
  actions: { flexDirection: 'row', gap: 12, paddingTop: 4 },
  action: { flex: 1 },
  pressed: { backgroundColor: theme.surface.subtle },
}))
