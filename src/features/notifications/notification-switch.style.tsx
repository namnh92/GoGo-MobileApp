import { StyleSheet } from 'react-native'

import { colors, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  syncState: {
    minHeight: touchTarget.min,
    marginTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  syncText: { ...type.bodySmall, color: neutral[500] },
  subTitle: {
    ...type.label,
    fontWeight: '700',
    color: neutral[500],
    textTransform: 'uppercase',
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  card: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginTop: spacing[3], gap: spacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    minHeight: touchTarget.min,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...type.body, fontWeight: '700', color: neutral[900] },
  rowHint: { ...type.bodySmall, color: neutral[500] },
  hint: { ...type.bodySmall, color: brand.amber },
  deviceCard: { padding: spacing[4], gap: spacing[3] },
  note: { ...type.bodySmall, color: neutral[700] },
  warning: { ...type.bodySmall, color: brand.amber },
  caption: { ...type.caption, color: neutral[500], marginTop: spacing[3] },
  error: { ...type.bodySmall, color: brand.red, marginTop: spacing[3] },
})
