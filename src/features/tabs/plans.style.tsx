import { StyleSheet } from 'react-native'
import { colors, radius, spacing } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: neutral[900], paddingHorizontal: spacing[5], paddingVertical: spacing[3] },
  caption: {
    fontSize: 13,
    fontWeight: '600',
    color: neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing[3],
  },
  upcomingCard: {
    padding: spacing[4],
    marginBottom: spacing[6],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  upcomingIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.compact,
    backgroundColor: brand.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingTitle: { fontSize: 15, fontWeight: '700', color: neutral[900] },
  upcomingMeta: { fontSize: 13, color: neutral[500], marginTop: 2 },
  pastCard: { flexDirection: 'row', overflow: 'hidden', marginBottom: spacing[3] },
  pastThumb: { width: 80, height: 80 },
  pastTitle: { fontSize: 14, fontWeight: '700', color: neutral[900] },
  pastDate: { fontSize: 12, color: neutral[500], marginTop: 2 },
  pastMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: 6 },
  pastRating: { fontSize: 12, fontWeight: '600', color: brand.coral },
})
