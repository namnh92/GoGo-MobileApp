import { StyleSheet } from 'react-native-unistyles'

import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  card: { padding: spacing[5], gap: spacing[4] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.soft,
  },
  titleText: { flex: 1 },
  field: { padding: spacing[4], gap: spacing[3] },
  budgetGroup: { gap: spacing[2] },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  value: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: 52, padding: spacing[3], borderRadius: 12, backgroundColor: theme.surface.subtle },
  budgetSelected: { backgroundColor: theme.accent.soft },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: theme.text.secondary, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: theme.accent.onSoft },
  pressed: { backgroundColor: theme.surface.subtle },
  notice: { textAlign: 'center' },
}))
