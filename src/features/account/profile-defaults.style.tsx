import { StyleSheet } from 'react-native'

import { colors, glassFx, overlay, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  card: { padding: spacing[5], marginTop: spacing[4], gap: spacing[4] },
  sectionTitle: { ...type.body, fontWeight: '700', color: neutral[900] },
  sectionBody: { ...type.bodySmall, color: neutral[500] },
  fieldLabel: { ...type.label, color: neutral[700] },
  field: { gap: spacing[2] },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  value: { ...type.body, color: neutral[900], flex: 1 },
  valueMuted: { ...type.body, color: neutral[500], flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  hint: { ...type.caption, color: neutral[500] },
  problem: { ...type.bodySmall, color: brand.amber },
  notice: { ...type.bodySmall, color: neutral[500], textAlign: 'center' },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: overlay.backdrop },
  sheet: {
    backgroundColor: glassFx.sheet,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    maxHeight: '75%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: neutral[100],
    alignSelf: 'center',
    marginBottom: spacing[4],
  },
  sheetTitle: { ...type.title1, color: neutral[900], marginBottom: spacing[3] },
  cityHeader: {
    ...type.caption,
    fontWeight: '700',
    color: neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing[4],
    marginBottom: spacing[1],
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTarget.min,
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: neutral[100],
  },
  areaLabel: { ...type.body, color: neutral[700] },
  areaLabelSelected: { color: brand.coral, fontWeight: '700' },
  sheetState: { ...type.body, color: neutral[500], textAlign: 'center', paddingVertical: spacing[5] },
})
