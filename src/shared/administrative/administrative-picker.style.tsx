import { StyleSheet } from 'react-native-unistyles'

import { colors, radius, spacing, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  root: { gap: spacing[2] },
  row: { minHeight: 48, padding: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.neutral[100] },
  modal: { flex: 1, backgroundColor: colors.neutral[50], paddingHorizontal: spacing[5] },
  input: { ...type.body, color: colors.neutral[900], minHeight: 48, paddingHorizontal: spacing[3], borderWidth: 1, borderColor: colors.neutral[300], borderRadius: radius.compact },
})
