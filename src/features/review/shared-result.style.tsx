import { StyleSheet } from 'react-native'
import { colors, radius, spacing, night, onDark, overlay, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: neutral[900] },
  title: { ...type.title1, color: neutral[0], textAlign: 'center', marginTop: spacing[4] },
  scoreCard: {
    backgroundColor: brand.coral,
    borderRadius: radius.sheet,
    padding: spacing[6],
    marginTop: spacing[4],
    marginBottom: spacing[4],
    alignItems: 'center',
  },
  score: { ...type.display, color: neutral[0] },
  scoreMax: { ...type.body, color: onDark.medium },
  darkCard: {
    backgroundColor: night.surface,
    borderRadius: radius.hero,
    padding: spacing[5],
    marginBottom: spacing[4],
  },
  caption: {
    ...type.caption,
    fontWeight: '700',
    color: neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[3],
  },
  interestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] },
  interestHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  interestLabel: { ...type.label, color: neutral[0] },
  interestPct: { ...type.caption, color: onDark.soft },
  track: { height: 6, borderRadius: 3, backgroundColor: night.line, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: brand.coral, borderRadius: 3 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  statCard: { width: '47%', backgroundColor: night.raised, borderRadius: radius.compact, padding: spacing[3] },
  statLabel: { ...type.caption, color: onDark.soft, marginBottom: 4 },
  // Without an explicit colour this rendered as black text on a dark card.
  statValue: { ...type.title1, color: neutral[0] },
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
  shareLabel: { ...type.body, fontWeight: '700', color: neutral[0] },
  scoreCaption: { ...type.caption, color: onDark.soft, marginTop: 4 },
  winnerName: { ...type.display, color: neutral[0], textAlign: 'center' },

  /** The place itself, as the summary card people actually share. */
  heroCard: {
    height: 240,
    borderRadius: radius.hero,
    overflow: 'hidden',
    marginTop: spacing[4],
    marginBottom: spacing[4],
    justifyContent: 'flex-end',
  },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: overlay.scrim },
  heroBody: { padding: spacing[5], gap: 4 },
  heroMeta: { ...type.bodySmall, color: onDark.strong, textAlign: 'center' },
  shareIsPrimary: {
    backgroundColor: brand.coral,
    borderColor: brand.coral,
    marginTop: 0,
    marginBottom: spacing[2],
  },
})
