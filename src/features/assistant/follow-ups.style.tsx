import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

/** Chips: 44pt tall (the touch target), `space-2` apart, wrapping. */
export const styles = StyleSheet.create(theme => ({
  group: { gap: theme.spacing[2] },
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
  chipPressed: { backgroundColor: theme.surface.subtle },
  chipAccent: { backgroundColor: theme.accent.soft, borderColor: theme.accent.soft },
  chipAccentPressed: { backgroundColor: theme.surface.subtle },
  chipDisabled: { backgroundColor: theme.surface.subtle },
}))
