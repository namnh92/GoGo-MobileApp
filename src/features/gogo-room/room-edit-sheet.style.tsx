import { StyleSheet } from 'react-native-unistyles'
import { spacing, touchTarget, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  conditionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3], minHeight: touchTarget.min },
  flex: { flex: 1 },
  editorBody: { gap: spacing[4], paddingTop: spacing[2] },
  editorSection: { padding: spacing[0], marginBottom: spacing[0], gap: spacing[2] },
  fieldGroup: { gap: spacing[2] },
  scheduleColumn: { flex: 1, minWidth: 0, gap: spacing[2] },
  scheduleLabel: { height: type.label.lineHeight },
})
