import { StyleSheet } from 'react-native'
import { colors, spacing } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[7],
  },
  burst: { fontSize: 64, marginBottom: spacing[4] },
  title: { fontSize: 32, fontWeight: '800', color: neutral[900] },
  body: { fontSize: 15, color: neutral[500], marginTop: spacing[2], marginBottom: spacing[7], textAlign: 'center' },
  card: { alignSelf: 'stretch', padding: spacing[5], marginBottom: spacing[7] },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] },
  stopName: { fontSize: 15, fontWeight: '600', color: neutral[900] },
  stopRating: { fontSize: 11, marginTop: 2 },
  photoStrip: { flexDirection: 'row', gap: 4 },
  photoThumb: { width: 32, height: 32, borderRadius: 8 },
  connector: { height: 16, width: 2, backgroundColor: neutral[100], alignSelf: 'center', marginVertical: 2 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: neutral[100],
    marginTop: spacing[3],
    paddingTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerMeta: { fontSize: 13, color: neutral[500] },
  stars: { flexDirection: 'row', gap: 2 },
  cta: { alignSelf: 'stretch' },
})
