import { StyleSheet } from 'react-native'

import { colors, radius, spacing } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  card: { padding: spacing[5], marginTop: spacing[4], gap: spacing[3] },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  stars: { fontSize: 15 },
  status: { fontSize: 12, fontWeight: '700' },
  status_pending: { color: brand.amber },
  status_published: { color: brand.mint },
  status_rejected: { color: brand.red },
  status_removed: { color: neutral[500] },
  starsRow: { flexDirection: 'row', gap: spacing[2] },
  starPick: { fontSize: 26 },
  starDim: { opacity: 0.3 },
  text: { fontSize: 14, color: neutral[700], lineHeight: 20 },
  date: { fontSize: 12, color: neutral[500] },
  hint: { fontSize: 12, color: neutral[500], lineHeight: 18 },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: neutral[100],
    borderRadius: radius.card,
    padding: spacing[3],
    fontSize: 15,
    color: neutral[900],
    textAlignVertical: 'top',
    backgroundColor: neutral[0],
  },
  actions: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
})
