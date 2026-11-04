import { StyleSheet } from 'react-native-unistyles'

import { radius, spacing, touchTarget, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  body: { marginBottom: spacing[4] },
  card: { padding: spacing[5], gap: spacing[3] },
  input: {
    ...type.body,
    minHeight: touchTarget.min,
    borderWidth: 1,
    borderColor: theme.text.tertiary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing[4],
    color: theme.text.primary,
    backgroundColor: theme.surface.subtle,
  },
  error: { textAlign: 'center', marginTop: spacing[4] },
  footnote: { textAlign: 'center' },
}))
