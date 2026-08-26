import { StyleSheet } from 'react-native'
import { colors, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  stepLabel: { fontSize: 13, color: colors.neutral[500], fontWeight: '500' },
  title: { fontSize: 28, fontWeight: '800', color: colors.neutral[900], lineHeight: 34 },
  body: { fontSize: 15, color: colors.neutral[500], marginTop: spacing[2], marginBottom: spacing[5] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    height: 56,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
  },
  chipLabel: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[900],
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
})
