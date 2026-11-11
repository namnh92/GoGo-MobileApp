import { StyleSheet } from 'react-native-unistyles'
import { radius, spacing } from './tokens'

export const styles = StyleSheet.create(theme => ({
  field: {
    width: '100%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: radius.compact,
    backgroundColor: theme.surface.subtle,
    borderWidth: 1,
    borderColor: theme.border.hairline,
  },
  label: { flex: 1 },
}))
