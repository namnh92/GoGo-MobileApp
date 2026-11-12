import { StyleSheet } from 'react-native-unistyles'
import { spacing, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  fieldGroup: { gap: spacing[2] },
  scheduleColumn: { flex: 1, minWidth: 0, gap: spacing[2] },
  scheduleLabel: { height: type.label.lineHeight },
})
