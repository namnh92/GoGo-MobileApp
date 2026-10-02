import { StyleSheet } from 'react-native-unistyles'

import { colors, night, radius, spacing } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create(theme => ({
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

  /** What is happening, and why it is taking a moment (spec §18). */
  message: { textAlign: 'center' },
  reason: { textAlign: 'center' },
  progressTrack: {
    alignSelf: 'stretch',
    height: 4,
    borderRadius: 2,
    backgroundColor: night.line,
    overflow: 'hidden',
    marginTop: spacing[5],
  },
  progressFill: { height: '100%', backgroundColor: theme.accent.primary, borderRadius: 2 },

  matched: { textAlign: 'center' },
  matchedBody: { marginTop: spacing[2], textAlign: 'center' },
  backLink: { textDecorationLine: 'underline' },
  retryBtn: {
    minHeight: 48,
    paddingHorizontal: spacing[6],
    borderRadius: radius.compact,
    borderWidth: 1,
    borderColor: night.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
