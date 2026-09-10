import { StyleSheet } from 'react-native'

import { colors, glassFx, glyph, radius, spacing, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[5], paddingBottom: spacing[4] },
  nameLabel: { ...type.label, color: neutral[900], marginTop: spacing[4], marginBottom: spacing[2] },
  nameInput: { ...type.body, color: neutral[900], minHeight: 48, padding: spacing[3], borderWidth: 1, borderColor: neutral[300], borderRadius: radius.compact },
  title: {
    ...type.display,
    color: neutral[900],
    marginTop: spacing[2],
  },
  option: {
    borderRadius: radius.hero,
    padding: spacing[5],
    flexDirection: 'row',
    gap: spacing[4],
    alignItems: 'flex-start',
  },
  optionActive: {
    backgroundColor: brand.coral,
    borderWidth: 1,
    borderColor: brand.coralDeep,
  },
  optionPressed: { transform: [{ scale: 0.99 }], opacity: 0.95 },
  optionEmoji: { fontSize: glyph.md },
  optionTitle: { ...type.title2 },
  optionDesc: { ...type.bodySmall, marginTop: 4, lineHeight: 19 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: glassFx.solid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
  },
})
