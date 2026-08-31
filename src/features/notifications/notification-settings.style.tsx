import { StyleSheet } from 'react-native'

import { colors, spacing, touchTarget } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 13,
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
  rowLabel: { flex: 1, fontSize: 15, color: neutral[900] },
  note: { fontSize: 12, color: neutral[500], lineHeight: 18, marginTop: spacing[5] },
  error: { fontSize: 13, color: brand.red, marginTop: spacing[3] },
})
