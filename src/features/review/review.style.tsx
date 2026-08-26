import { StyleSheet } from 'react-native'
import { colors, radius, spacing } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: neutral[900], lineHeight: 32 },
  body: { fontSize: 14, color: neutral[500], marginTop: spacing[2], marginBottom: spacing[6] },
  starsCard: { borderRadius: radius.hero, padding: spacing[6], alignItems: 'center', marginBottom: spacing[4] },
  starsRow: { flexDirection: 'row', gap: spacing[3], marginBottom: spacing[3] },
  star: { fontSize: 36 },
  starDim: { opacity: 0.25 },
  ratingLabel: { fontSize: 13, color: neutral[500] },
  tagsCard: { borderRadius: radius.hero, padding: spacing[5], marginBottom: spacing[4] },
  tagsTitle: { fontSize: 14, fontWeight: '700', color: neutral[900], marginBottom: spacing[3] },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tagBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.compact,
    backgroundColor: neutral[50],
  },
  tagBtnActive: { backgroundColor: brand.coral },
  tagLabel: { fontSize: 13, fontWeight: '600', color: neutral[500] },
  tagLabelActive: { color: neutral[0] },
  inputCard: { padding: spacing[4], marginBottom: spacing[4] },
  input: { minHeight: 80, fontSize: 14, color: neutral[900], textAlignVertical: 'top' },
})
