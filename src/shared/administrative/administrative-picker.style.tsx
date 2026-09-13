import { StyleSheet } from 'react-native'
import { colors, spacing, type, radius } from '@/shared/ui/tokens'
export const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  label: { ...type.label, color: colors.neutral[900] },
  text: { ...type.body, color: colors.neutral[900] },
  hint: { ...type.bodySmall, color: colors.neutral[500] },
  row: { minHeight: 48, padding: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.neutral[100] },
  modal: { flex: 1, backgroundColor: colors.neutral[50], paddingHorizontal: spacing[5] },
  input: { ...type.body, color: colors.neutral[900], minHeight: 48, paddingHorizontal: spacing[3], borderWidth: 1, borderColor: colors.neutral[300], borderRadius: radius.compact },
})
