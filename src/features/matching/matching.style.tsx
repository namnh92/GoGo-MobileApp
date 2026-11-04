import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  /** Holds the freshness notice slot above the centred content (#292). */
  screen: { flex: 1, backgroundColor: theme.surface.canvas },
  root: {
    flex: 1,
    backgroundColor: theme.surface.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  orbit: {
    width: 176,
    height: 176,
    borderRadius: 88,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.soft,
    marginBottom: spacing[7],
  },
  orbitCore: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.primary,
    ...theme.shadows.cta,
  },

  /** What is happening, and why it is taking a moment (spec §18). */
  message: { textAlign: 'center' },
  reason: { textAlign: 'center' },
  progressTrack: {
    alignSelf: 'stretch',
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.surface.subtle,
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
    borderColor: theme.border.hairline,
    backgroundColor: theme.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** The shared offline state is drawn for light surfaces; give it one here. */
  offlineCard: {
    alignSelf: 'stretch',
    borderRadius: radius.compact,
    backgroundColor: theme.surface.card,
  },
}))
