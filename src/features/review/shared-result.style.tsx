import { StyleSheet } from 'react-native-unistyles'
import { colors, fill, night, overlay, radius, spacing, touchTarget } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create(theme => ({
  root: { flex: 1, backgroundColor: neutral[900] },
  title: { textAlign: 'center', marginTop: spacing[4] },
  scoreCard: {
    backgroundColor: theme.accent.primary,
    borderRadius: radius.sheet,
    padding: spacing[6],
    marginTop: spacing[4],
    marginBottom: spacing[4],
    alignItems: 'center',
  },
  darkCard: {
    backgroundColor: night.surface,
    borderRadius: radius.hero,
    padding: spacing[5],
    marginBottom: spacing[4],
  },
  caption: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[3],
  },
  interestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] },
  interestHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  track: { height: 6, borderRadius: 3, backgroundColor: night.line, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: theme.accent.primary, borderRadius: 3 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  statCard: { width: '47%', backgroundColor: night.raised, borderRadius: radius.compact, padding: spacing[3] },
  statLabel: { marginBottom: 4 },
  shareBtn: {
    height: touchTarget.min + 12,
    borderRadius: radius.compact,
    borderWidth: 1,
    borderColor: night.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  scoreCaption: { marginTop: 4 },
  winnerName: { textAlign: 'center' },

  /** The place itself, as the summary card people actually share. */
  heroCard: {
    height: 240,
    borderRadius: radius.hero,
    overflow: 'hidden',
    marginTop: spacing[4],
    marginBottom: spacing[4],
    justifyContent: 'flex-end',
  },
  heroScrim: { ...fill, backgroundColor: overlay.scrim },
  heroBody: { padding: spacing[5], gap: 4 },
  heroMeta: { textAlign: 'center' },
  shareIsPrimary: {
    backgroundColor: theme.accent.primary,
    borderColor: theme.accent.primary,
    marginTop: 0,
    marginBottom: spacing[2],
  },
}))
