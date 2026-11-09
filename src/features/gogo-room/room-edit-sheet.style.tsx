import { StyleSheet } from 'react-native-unistyles'
import { spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  conditionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3], minHeight: touchTarget.min },
  flex: { flex: 1 },
})
