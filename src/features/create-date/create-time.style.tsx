import { StyleSheet } from 'react-native-unistyles'
import { radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing[5] },
  body: { marginTop: spacing[2], marginBottom: spacing[6] },
  option: {
    height: 56,
    borderRadius: radius.compact,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
  },
  optionActive: { backgroundColor: theme.accent.soft, borderWidth: 1, borderColor: theme.accent.primary },
  exactLabel: { marginBottom: spacing[3] },
  timeBox: {
    flex: 1,
    backgroundColor: theme.surface.subtle,
    borderRadius: radius.compact,
    padding: spacing[3],
    alignItems: 'center',
  },
  timeBoxRequired: { borderWidth: 1, borderColor: theme.accent.primary },
  requiredHint: { marginTop: spacing[2] },
  sheetTitle: { marginBottom: spacing[3] },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  slotBtn: {
    width: '23%',
    height: 44,
    borderRadius: radius.compact,
    backgroundColor: theme.surface.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotBtnActive: { backgroundColor: theme.accent.primary },
  timeValue: { marginTop: 2 },
}))
