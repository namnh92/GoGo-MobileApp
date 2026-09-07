import { StyleSheet } from 'react-native'

import { colors, glyph } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  image: { backgroundColor: colors.neutral[100] },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderGlyph: { fontSize: glyph.md, opacity: 0.55 },
})
