import { StyleSheet } from 'react-native'

import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  card: { padding: spacing[5], marginTop: spacing[4], gap: spacing[3] },
  sectionTitle: { ...type.body, fontWeight: '700', color: neutral[900] },
  sectionBody: { ...type.bodySmall, color: neutral[500] },
  warning: { ...type.caption, color: brand.amber },
  tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tier: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.pill,
    backgroundColor: neutral[100],
  },
  tierActive: { backgroundColor: brand.coral },
  tierLabel: { ...type.label, color: neutral[700] },
  tierLabelActive: { color: neutral[0] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: touchTarget.min,
    borderTopWidth: 1,
    borderTopColor: neutral[100],
    paddingTop: spacing[3],
  },
  rowTitle: { ...type.body, fontWeight: '600', color: neutral[900] },
  rowMeta: { ...type.caption, color: neutral[500], marginTop: 2 },
  rowAction: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
  },
  rowActionLabel: { ...type.label, color: brand.red },
  notice: { ...type.bodySmall, color: neutral[500], textAlign: 'center', marginTop: spacing[4] },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing[4], marginTop: spacing[2] },
  cancelLabel: { ...type.bodySmall, fontWeight: '600', color: brand.red },
})
