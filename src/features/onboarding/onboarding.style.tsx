import { StyleSheet } from 'react-native'
import { colors, spacing, glassFx } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  skip: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.neutral[500],
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[7],
    gap: spacing[4],
  },
  visual: {
    width: '100%',
    height: 180,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  chipCoral: {
    backgroundColor: colors.brand.coral,
  },
  chipGlass: {
    backgroundColor: glassFx.cardWash,
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  emoji: {
    fontSize: 40,
    marginTop: spacing[2],
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.neutral[900],
    textAlign: 'center',
    lineHeight: 32,
  },
  slideBody: {
    fontSize: 15,
    color: colors.neutral[500],
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: spacing[6],
    gap: spacing[2],
  },
})
