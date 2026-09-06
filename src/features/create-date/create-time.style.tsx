import { StyleSheet } from 'react-native'
import { colors, glassFx, overlay, radius, spacing, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  title: { ...type.display, color: colors.neutral[900] },
  body: { ...type.body, color: colors.neutral[500], marginTop: spacing[2], marginBottom: spacing[6] },
  option: {
    height: 56,
    borderRadius: radius.compact,
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
  },
  optionLabel: { ...type.title2, fontWeight: '600' },
  exactLabel: { ...type.bodySmall, color: colors.neutral[500], marginBottom: spacing[3] },
  timeBox: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    borderRadius: 12,
    padding: spacing[3],
    alignItems: 'center',
  },
  timeBoxRequired: { borderWidth: 1, borderColor: colors.brand.coral },
  requiredHint: { ...type.caption, color: colors.brand.coral, marginTop: spacing[2] },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: overlay.backdrop },
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
  sheetTitle: { ...type.title1, color: colors.neutral[900], marginBottom: spacing[3] },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  slotBtn: {
    width: '23%',
    height: 44,
    borderRadius: radius.compact,
    backgroundColor: colors.neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotLabel: { ...type.label, color: colors.neutral[700] },
  timeCaption: { ...type.caption, color: colors.neutral[500] },
  timeValue: { ...type.title1, color: colors.neutral[900], marginTop: 2 },
})
