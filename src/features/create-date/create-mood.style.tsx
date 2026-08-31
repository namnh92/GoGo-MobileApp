import { StyleSheet } from 'react-native'
import { colors, spacing } from '@/shared/ui/tokens'

const { neutral } = colors

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
  chipAuto: { alignSelf: 'flex-start', paddingHorizontal: spacing[4] },
  seedHint: { fontSize: 13, color: neutral[500], marginBottom: spacing[3], marginTop: -spacing[2] },
  seedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  seedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: colors.brand.coralSoft,
  },
  seedChipLabel: { fontSize: 13, fontWeight: '600', color: colors.brand.coral },
  seedAddBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: neutral[300],
  },
  seedAddLabel: { fontSize: 13, fontWeight: '600', color: neutral[500] },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.neutral[900],
    marginTop: spacing[6],
    marginBottom: spacing[3],
  },
  error: {
    fontSize: 13,
    color: colors.brand.red,
    marginTop: spacing[4],
  },
})
