import { StyleSheet } from 'react-native-unistyles'

import { glyph } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  image: { backgroundColor: theme.surface.subtle, overflow: 'hidden' },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface.subtle,
  },
  placeholderGlyph: { fontSize: glyph.md },
}))
