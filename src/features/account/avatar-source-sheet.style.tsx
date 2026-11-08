import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  content: { gap: 12 },
  heading: { alignItems: 'center', gap: 2, paddingBottom: 4 },
  group: { backgroundColor: theme.surface.card, borderRadius: 16, borderWidth: 1, borderColor: theme.redesign.outline, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, minHeight: 68 },
  divider: { borderTopWidth: 1, borderTopColor: theme.border.hairline },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface.subtle, borderWidth: 1, borderColor: theme.redesign.outline },
  dangerIcon: { backgroundColor: theme.status.dangerSoft },
  copy: { flex: 1, gap: 2 },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: theme.redesign.outline, backgroundColor: theme.surface.card },
  pressed: { backgroundColor: theme.surface.subtle },
  disabled: { opacity: 0.4 },
}))
