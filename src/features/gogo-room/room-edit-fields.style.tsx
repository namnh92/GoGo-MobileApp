import { StyleSheet } from 'react-native-unistyles'
import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldGroup: { gap: spacing[2] },
})
