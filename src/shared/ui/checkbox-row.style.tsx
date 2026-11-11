import { StyleSheet } from 'react-native-unistyles'
import { spacing, touchTarget } from './tokens'

export const styles = StyleSheet.create(theme => ({
  row: {
    minHeight: touchTarget.min,
    paddingVertical: 10,
    paddingHorizontal: spacing[3],
    borderRadius: 8,
    backgroundColor: theme.surface.subtle,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderColor: theme.surface.subtle,
  },
  selected: { borderColor: theme.accent.text },
  disabled: { opacity: 0.6 },
  label: { flex: 1 },
}))
