import { StyleSheet } from 'react-native'

import { colors, radius, spacing, type } from '@/shared/ui/tokens'

const { brand, neutral } = colors

// A warning surface: amber wash, ink text — the copy carries the meaning, not the colour.
export const styles = StyleSheet.create({
  container: {
    gap: spacing[2],
    padding: spacing[4],
    marginBottom: spacing[4],
    borderRadius: radius.compact,
    backgroundColor: brand.amberSoft,
  },
  body: { ...type.bodySmall, color: neutral[900] },
})
