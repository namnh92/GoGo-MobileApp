import { StyleSheet } from 'react-native-unistyles'
import { fill, night, overlay, radius, spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  root: { flex: 1, backgroundColor: theme.surface.canvas },
  /** The shareable card: one dark surface holding the result, buttons sit under it on the canvas. */
  summaryCard: {
    backgroundColor: night.surface,
    borderRadius: radius.hero,
    padding: spacing[4],
    marginBottom: spacing[4],
    ...theme.shadows.card,
  },
  title: { textAlign: 'left', marginTop: spacing[1] },
  scoreCard: {
    backgroundColor: theme.accent.primary,
    borderRadius: radius.sheet,
    padding: spacing[6],
    marginTop: spacing[4],
    marginBottom: spacing[4],
    alignItems: 'center',
  },
  darkCard: {
    backgroundColor: night.raised,
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
  statCard: { width: '47%', backgroundColor: night.surface, borderRadius: radius.compact, padding: spacing[3] },
  statLabel: { marginBottom: 4 },
  shareBtn: {
    height: touchTarget.min + 12,
    borderRadius: radius.compact,
    backgroundColor: theme.surface.subtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  scoreCaption: { marginTop: 4 },
  winnerName: { textAlign: 'left' },

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
  heroMeta: { textAlign: 'left' },
  shareIsPrimary: {
    backgroundColor: theme.accent.primary,
    marginTop: 0,
    marginBottom: spacing[2],
  },
  // Pressed is a colour change only (#382): the night surface steps up a
  // tone, the accent darkens.
  shareBtnPressed: { backgroundColor: theme.border.hairline },
  sharePrimaryPressed: { backgroundColor: theme.accent.pressed },
}))
