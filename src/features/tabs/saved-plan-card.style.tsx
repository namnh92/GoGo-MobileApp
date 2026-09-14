import { StyleSheet } from 'react-native'

import { colors, glyph, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  card: { width: '100%', padding: spacing[3], gap: spacing[2] },
  body: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], minHeight: touchTarget.min },
  glyph: { fontSize: glyph.sm },
  text: { flex: 1 },
  title: { ...type.title2, color: neutral[900] },
  meta: { ...type.bodySmall, color: neutral[500] },
  warning: { ...type.bodySmall, color: brand.amber },
})
