import { StyleSheet } from 'react-native-unistyles'

import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  field: { minHeight: 50, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border.hairline, backgroundColor: theme.redesign.low, flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldLabel: { flex: 1 },
  fieldDisabled: { opacity: 0.4 },
  fieldPressed: { backgroundColor: theme.redesign.high },
  communeLabel: { marginTop: 8 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, padding: 8, backgroundColor: theme.accent.soft },
  root: { gap: spacing[2] },
  row: { minHeight: 48, padding: spacing[3], borderBottomWidth: 1, borderBottomColor: theme.border.hairline },
  /** Inside the full-height `Sheet`, which pads the sides and the safe area. */
  sheetBody: { flex: 1, gap: spacing[2] },
}))
