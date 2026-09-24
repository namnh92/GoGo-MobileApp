import { StyleSheet } from 'react-native-unistyles'

import { glyph, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  card: { width: '100%', gap: theme.spacing[2] },
  body: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], minHeight: touchTarget.min },
  glyph: { fontSize: glyph.sm },
  text: { flex: 1, minWidth: 0 },
}))
