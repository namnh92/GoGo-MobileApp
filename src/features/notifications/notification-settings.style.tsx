import { StyleSheet } from 'react-native'

import { colors, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  sectionTitle: {
    ...type.label,
    fontWeight: '700',
    color: neutral[500],
    textTransform: 'uppercase',
    marginTop: spacing[5],
    marginBottom: spacing[2],
  },
  card: { padding: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    minHeight: touchTarget.min,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: neutral[100],
  },
  rowLabel: { ...type.body, flex: 1, color: neutral[900] },
  note: { ...type.caption, color: neutral[500], marginTop: spacing[5] },
  error: { ...type.bodySmall, color: brand.red, marginTop: spacing[3] },
})
