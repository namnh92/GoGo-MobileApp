import { StyleSheet } from 'react-native'

import { colors, radius, spacing, touchTarget } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  body: { fontSize: 14, color: neutral[500], lineHeight: 20, marginBottom: spacing[4] },
  card: { padding: spacing[5], gap: spacing[3] },
  label: { fontSize: 13, fontWeight: '600', color: neutral[700] },
  input: {
    minHeight: touchTarget.min,
    borderWidth: 1,
    borderColor: neutral[100],
    borderRadius: radius.pill,
    paddingHorizontal: spacing[4],
    fontSize: 16,
    color: neutral[900],
    backgroundColor: neutral[0],
  },
  error: { fontSize: 13, color: brand.red, textAlign: 'center', marginTop: spacing[4] },
  footnote: { fontSize: 12, color: neutral[500], textAlign: 'center' },
})
