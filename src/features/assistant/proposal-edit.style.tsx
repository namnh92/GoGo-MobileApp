import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  body: { gap: theme.spacing[4] },
  field: { gap: theme.spacing[1] },
  input: {
    ...theme.type.body,
    minHeight: 48,
    borderRadius: theme.radius.compact,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    backgroundColor: theme.surface.card,
    paddingHorizontal: theme.spacing[4],
    color: theme.text.primary,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[2] },
  chip: {
    minHeight: touchTarget.min,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing[4],
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.border.hairline,
    backgroundColor: theme.surface.card,
  },
  chipOn: { backgroundColor: theme.accent.soft, borderColor: theme.accent.primary },
  chipPressed: { backgroundColor: theme.surface.subtle },
  actions: { gap: theme.spacing[2] },
}))
