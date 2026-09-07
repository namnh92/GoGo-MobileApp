import { StyleSheet } from 'react-native'

import { colors, glyph, radius, spacing, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  card: { padding: spacing[5], marginTop: spacing[4], gap: spacing[3] },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  stars: { ...type.body },
  status: { ...type.label, fontWeight: '700' },
  status_pending: { color: brand.amber },
  status_published: { color: brand.mint },
  status_rejected: { color: brand.red },
  status_removed: { color: neutral[500] },
  starsRow: { flexDirection: 'row', gap: spacing[2] },
  starPick: { fontSize: glyph.sm },
  starDim: { opacity: 0.3 },
  text: { ...type.bodySmall, color: neutral[700] },
  date: { ...type.caption, color: neutral[500] },
  hint: { ...type.caption, color: neutral[500] },
  input: {
    ...type.body,
    minHeight: 88,
    borderWidth: 1,
    borderColor: neutral[100],
    borderRadius: radius.card,
    padding: spacing[3],
    color: neutral[900],
    textAlignVertical: 'top',
    backgroundColor: neutral[0],
  },
  actions: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
})
