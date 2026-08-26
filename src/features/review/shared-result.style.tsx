import { StyleSheet } from 'react-native'
import { colors, radius, spacing, night, onDark } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: neutral[900] },
  title: { fontSize: 26, fontWeight: '800', color: neutral[0], textAlign: 'center', marginTop: spacing[4] },
  scoreCard: {
    backgroundColor: brand.coral,
    borderRadius: radius.sheet,
    padding: spacing[6],
    marginTop: spacing[4],
    marginBottom: spacing[4],
    alignItems: 'center',
  },
  score: { fontSize: 56, fontWeight: '800', color: neutral[0], lineHeight: 60 },
  scoreMax: { fontSize: 15, fontWeight: '500', color: onDark.medium },
  scoreStars: { flexDirection: 'row', gap: 4, marginTop: spacing[2] },
  darkCard: {
    backgroundColor: night.surface,
    borderRadius: radius.hero,
    padding: spacing[5],
    marginBottom: spacing[4],
  },
  caption: {
    fontSize: 12,
    fontWeight: '600',
    color: neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[3],
  },
  interestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] },
  interestHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  interestLabel: { fontSize: 13, fontWeight: '600', color: neutral[0] },
  interestPct: { fontSize: 12, color: neutral[500] },
  track: { height: 6, borderRadius: 3, backgroundColor: night.line, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: brand.coral, borderRadius: 3 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  statCard: { width: '47%', backgroundColor: night.raised, borderRadius: radius.compact, padding: spacing[3] },
  statLabel: { fontSize: 11, color: neutral[500], marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '800' },
  nextBtn: {
    height: 56,
    borderRadius: radius.compact,
    backgroundColor: brand.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextLabel: { fontSize: 16, fontWeight: '600', color: neutral[0] },
  shareBtn: {
    height: 48,
    borderRadius: radius.compact,
    borderWidth: 1,
    borderColor: night.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  shareLabel: { fontSize: 15, fontWeight: '500', color: neutral[0] },
})
