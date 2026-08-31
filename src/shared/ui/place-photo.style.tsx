import { StyleSheet } from 'react-native'

import { colors } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  image: { backgroundColor: colors.neutral[100] },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderGlyph: { fontSize: 28, opacity: 0.55 },
})
