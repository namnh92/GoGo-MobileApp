import { StyleSheet } from 'react-native'
import { colors, radius, spacing } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  badge: {
    backgroundColor: 'rgba(216,79,74,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: spacing[4],
  },
  badgeLabel: { fontSize: 12, fontWeight: '600', color: brand.coral },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: neutral[900],
    textAlign: 'center',
    lineHeight: 30,
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  pairName: { fontSize: 12, fontWeight: '600', color: neutral[900] },
  details: { borderRadius: radius.hero, padding: spacing[5], marginBottom: spacing[6] },
  detailsTitle: { fontSize: 14, fontWeight: '700', color: neutral[900], marginBottom: spacing[3] },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: neutral[100],
  },
  detailLabel: { fontSize: 14, color: neutral[500] },
  noAccount: { textAlign: 'center', fontSize: 13, color: neutral[500] },
})
