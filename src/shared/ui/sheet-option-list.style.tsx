import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  group: { backgroundColor: theme.surface.card, borderRadius: 16, borderWidth: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 68 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border.hairline },
  copy: { flex: 1, gap: 2 },
  pressed: { backgroundColor: theme.surface.subtle },
  disabled: { opacity: 0.4 },
}))
