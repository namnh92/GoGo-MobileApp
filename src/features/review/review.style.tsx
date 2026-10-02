import { StyleSheet } from 'react-native-unistyles'

import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create({
  body: { marginTop: spacing[2], marginBottom: spacing[6] },

  /** #277 — which stop (or the whole outing) the stars below belong to. */
  subjects: { marginBottom: spacing[5] },
  subjectLabel: { marginBottom: spacing[2] },
  subjectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },

  starsCard: { borderRadius: radius.hero, padding: spacing[6], alignItems: 'center', marginBottom: spacing[4] },
  starsRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  /** Each star is its own control, so each one has to clear 44pt. */
  starTap: {
    minWidth: touchTarget.min,
    minHeight: touchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starDim: { opacity: 0.25 },

  inputCard: { padding: spacing[4], marginBottom: spacing[2] },
  input: { minHeight: 96, ...type.body, color: neutral[900], textAlignVertical: 'top' },
  counterRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing[4] },

  moderationNote: { marginTop: spacing[3] },
  error: { marginTop: spacing[3] },
  hint: { textAlign: 'center', marginBottom: spacing[2] },

  // --- success -------------------------------------------------------------
  successRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[7],
    gap: spacing[3],
  },
  successTitle: { textAlign: 'center' },
  successBody: { textAlign: 'center' },
  successActions: { alignSelf: 'stretch', marginTop: spacing[5] },
})
