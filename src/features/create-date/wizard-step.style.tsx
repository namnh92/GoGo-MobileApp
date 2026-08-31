import { StyleSheet } from 'react-native'

import { colors, spacing, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  dots: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  stepLabel: { ...type.label, color: colors.neutral[500] },
})
