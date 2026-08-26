import { StyleSheet } from 'react-native'
import { colors, radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  stepLabel: { fontSize: 13, color: colors.neutral[500], fontWeight: '500' },
  title: { fontSize: 28, fontWeight: '800', color: colors.neutral[900], lineHeight: 34 },
  body: { fontSize: 15, color: colors.neutral[500], marginTop: spacing[2], marginBottom: spacing[6] },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.neutral[900] },
  rowSub: { fontSize: 13, color: colors.neutral[500] },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.neutral[900], marginTop: spacing[2], marginBottom: spacing[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  radiusBtn: {
    width: '48%',
    height: 48,
    borderRadius: radius.compact,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radiusLabel: { fontSize: 14, fontWeight: '600' },
})
