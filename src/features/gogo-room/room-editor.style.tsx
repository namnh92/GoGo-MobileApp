import { StyleSheet } from 'react-native-unistyles'
import { chipRowGap, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  body: { gap: spacing[4] },
  section: { gap: spacing[2] },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  hidden: { display: 'none' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: chipRowGap },
  scheduleFields: { flexDirection: 'row', gap: spacing[3] },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
})
