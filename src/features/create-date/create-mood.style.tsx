import { StyleSheet } from 'react-native'

import { colors, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  title: { ...type.display, color: neutral[900] },
  body: { ...type.body, color: neutral[500], marginTop: spacing[2], marginBottom: spacing[5] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  seedHint: { ...type.bodySmall, color: neutral[500], marginBottom: spacing[3], marginTop: -spacing[2] },
  seedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], alignItems: 'center' },
  seedAddBtn: {
    minHeight: touchTarget.min - 12,
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: neutral[300],
  },
  seedAddLabel: { ...type.label, color: neutral[500] },
  sectionTitle: {
    ...type.title2,
    color: neutral[900],
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  error: { ...type.bodySmall, color: brand.red, marginTop: spacing[4] },
})
