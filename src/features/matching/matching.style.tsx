import { StyleSheet } from 'react-native'

import { colors, night, onDark, radius, spacing, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: neutral[900],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    marginBottom: spacing[7],
  },
  times: { ...type.display, color: onDark.soft },

  /** What is happening, and why it is taking a moment (spec §18). */
  message: { ...type.body, color: onDark.strong, fontWeight: '600', textAlign: 'center' },
  reason: { ...type.bodySmall, color: onDark.soft, textAlign: 'center' },
  progressTrack: {
    alignSelf: 'stretch',
    height: 4,
    borderRadius: 2,
    backgroundColor: night.line,
    overflow: 'hidden',
    marginTop: spacing[5],
  },
  progressFill: { height: '100%', backgroundColor: brand.coral, borderRadius: 2 },

  matched: { ...type.display, color: neutral[0], textAlign: 'center' },
  matchedBody: { ...type.body, color: onDark.soft, marginTop: spacing[2], textAlign: 'center' },
  backLink: { ...type.label, color: brand.coral, textDecorationLine: 'underline' },
  retryBtn: {
    minHeight: 48,
    paddingHorizontal: spacing[6],
    borderRadius: radius.compact,
    borderWidth: 1,
    borderColor: night.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: { ...type.body, fontWeight: '700', color: neutral[0] },
})
