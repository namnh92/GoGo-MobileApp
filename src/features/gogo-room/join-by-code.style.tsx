import { StyleSheet } from 'react-native-unistyles'

import { colors, radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create({
  body: { marginBottom: spacing[4] },
  card: { padding: spacing[5], gap: spacing[3] },
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
  error: { textAlign: 'center', marginTop: spacing[4] },
  footnote: { textAlign: 'center' },
})
