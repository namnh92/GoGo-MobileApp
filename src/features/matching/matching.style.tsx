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
    width: 232,
    height: 232,
    borderRadius: 116,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface.subtle,
    marginBottom: spacing[6],
  },
  orbitPing: {
    position: 'absolute',
    width: 232,
    height: 232,
    borderRadius: 116,
    backgroundColor: theme.accent.soft,
  },
  orbitMid: {
    width: 168,
    height: 168,
    borderRadius: 84,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.soft,
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
  satellite: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface.card,
    ...theme.shadows.card,
  },
  satelliteTop: { top: -8, alignSelf: 'center' },
  satelliteLeft: { left: 8, bottom: 24 },
  satelliteRight: { right: 8, bottom: 24 },

  /** What is happening, and why it is taking a moment (spec §18). */
  message: { textAlign: 'center' },
  reason: { textAlign: 'center' },
  statusCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginTop: spacing[5],
    padding: spacing[4],
    borderRadius: radius.card,
    backgroundColor: theme.surface.card,
    borderWidth: 1,
    borderColor: theme.border.hairline,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.soft,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.surface.subtle,
    overflow: 'hidden',
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
