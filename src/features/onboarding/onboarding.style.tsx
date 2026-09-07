import { StyleSheet } from 'react-native'
import { colors, glassFx, glyph, spacing, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  skip: {
    ...type.bodySmall,
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
  chipLabel: { ...type.label,
  },
  emoji: {
    fontSize: glyph.xl,
    marginTop: spacing[2],
  },
  title: {
    ...type.display,
    color: colors.neutral[900],
    textAlign: 'center',
  },
  slideBody: {
    ...type.body,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing[6],
    gap: spacing[2],
  },
})
