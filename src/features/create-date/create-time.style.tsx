import { StyleSheet } from 'react-native-unistyles'
import { colors, fill, glassFx, overlay, radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  body: { marginTop: spacing[2], marginBottom: spacing[6] },
  option: {
    height: 56,
    borderRadius: radius.compact,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
  },
  exactLabel: { marginBottom: spacing[3] },
  timeBox: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    borderRadius: 12,
    padding: spacing[3],
    alignItems: 'center',
  },
  timeBoxRequired: { borderWidth: 1, borderColor: theme.accent.primary },
  requiredHint: { marginTop: spacing[2] },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...fill, backgroundColor: overlay.backdrop },
  sheet: {
    backgroundColor: glassFx.sheet,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[100],
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
  sheetTitle: { marginBottom: spacing[3] },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  slotBtn: {
    width: '23%',
    height: 44,
    borderRadius: radius.compact,
    backgroundColor: colors.neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeValue: { marginTop: 2 },
}))
