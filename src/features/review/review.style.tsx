import { StyleSheet } from 'react-native'

import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  title: { ...type.display, color: neutral[900] },
  body: { ...type.body, color: neutral[500], marginTop: spacing[2], marginBottom: spacing[6] },

  starsCard: { borderRadius: radius.hero, padding: spacing[6], alignItems: 'center', marginBottom: spacing[4] },
  starsRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  /** Each star is its own control, so each one has to clear 44pt. */
  starTap: {
    minWidth: touchTarget.min,
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: { fontSize: 34 },
  starDim: { opacity: 0.25 },
  ratingLabel: { ...type.body, fontWeight: '600', color: neutral[700] },

  inputCard: { padding: spacing[4], marginBottom: spacing[2] },
  input: { minHeight: 96, ...type.body, color: neutral[900], textAlignVertical: 'top' },
  counterRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing[4] },
  counter: { ...type.caption, color: neutral[300] },
  counterNear: { color: brand.amber, fontWeight: '700' },

  moderationNote: { ...type.caption, color: neutral[500], lineHeight: 17, marginTop: spacing[3] },
  error: { ...type.bodySmall, color: brand.red, marginTop: spacing[3] },
  hint: { ...type.bodySmall, color: neutral[500], textAlign: 'center', marginBottom: spacing[2] },

  // --- success -------------------------------------------------------------
  successRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[7],
    gap: spacing[3],
  },
  successGlyph: { fontSize: 56 },
  successTitle: { ...type.title1, color: neutral[900], textAlign: 'center' },
  successBody: { ...type.body, color: neutral[500], textAlign: 'center', lineHeight: 22 },
  successActions: { alignSelf: 'stretch', marginTop: spacing[5] },
})
