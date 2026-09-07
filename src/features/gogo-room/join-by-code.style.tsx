import { StyleSheet } from 'react-native'

import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

export const styles = StyleSheet.create({
  body: { ...type.bodySmall, color: neutral[500], marginBottom: spacing[4] },
  card: { padding: spacing[5], gap: spacing[3] },
  label: { ...type.label, color: neutral[700] },
  input: {
    ...type.body,
    minHeight: touchTarget.min,
    borderWidth: 1,
    borderColor: neutral[100],
    borderRadius: radius.pill,
    paddingHorizontal: spacing[4],
    color: neutral[900],
    backgroundColor: neutral[0],
  },
  error: { ...type.bodySmall, color: brand.red, textAlign: 'center', marginTop: spacing[4] },
  footnote: { ...type.caption, color: neutral[500], textAlign: 'center' },
})
