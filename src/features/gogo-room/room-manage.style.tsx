import { StyleSheet } from 'react-native'

import { colors, radius, spacing, touchTarget } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  card: { padding: spacing[5], marginTop: spacing[4], gap: spacing[3] },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: neutral[900] },
  sectionBody: { fontSize: 13, color: neutral[500], lineHeight: 19 },
  warning: { fontSize: 12, color: brand.amber, lineHeight: 18 },
  tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tier: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.pill,
    backgroundColor: neutral[100],
  },
  tierActive: { backgroundColor: brand.coral },
  tierLabel: { fontSize: 13, fontWeight: '600', color: neutral[700] },
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
  rowTitle: { fontSize: 15, fontWeight: '600', color: neutral[900] },
  rowMeta: { fontSize: 12, color: neutral[500], marginTop: 2 },
  rowAction: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
  },
  rowActionLabel: { fontSize: 13, fontWeight: '600', color: brand.red },
  notice: { fontSize: 13, color: neutral[500], textAlign: 'center', marginTop: spacing[4] },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing[4], marginTop: spacing[2] },
  cancelLabel: { fontSize: 14, fontWeight: '600', color: brand.red },
})
