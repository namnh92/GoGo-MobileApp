import { StyleSheet } from 'react-native'
import { colors, radius, spacing } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[7] },
  eyes: { fontSize: 56, marginBottom: spacing[5] },
  title: { fontSize: 28, fontWeight: '800', color: neutral[900], textAlign: 'center', lineHeight: 34 },
  body: { fontSize: 15, color: neutral[500], marginTop: spacing[3], marginBottom: spacing[8], textAlign: 'center' },
  card: { alignSelf: 'stretch', padding: spacing[5], marginBottom: spacing[7] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  name: { fontSize: 14, fontWeight: '700', color: neutral[900] },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  doneLabel: { fontSize: 13, fontWeight: '600', color: brand.mint },
  notStarted: { fontSize: 13, fontWeight: '500', color: neutral[300] },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  progressTrack: { height: 6, width: 96, borderRadius: 3, backgroundColor: neutral[100], overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: brand.lavender, borderRadius: 3 },
  progressLabel: { fontSize: 13, fontWeight: '500', color: neutral[500] },
  remindBtn: {
    height: 48,
    paddingHorizontal: spacing[6],
    borderRadius: radius.compact,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remindLabel: { fontSize: 15, fontWeight: '600', color: neutral[500] },
  partialBtn: {
    height: 48,
    paddingHorizontal: spacing[6],
    borderRadius: radius.compact,
    backgroundColor: neutral[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  partialLabel: { fontSize: 15, fontWeight: '600', color: neutral[0] },
  partialWarning: { fontSize: 12, fontWeight: '500', color: brand.coral },
})
