import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  card: {
    gap: theme.spacing[4],
    padding: theme.spacing[4],
    borderRadius: theme.radius.card,
    backgroundColor: theme.surface.card,
    ...theme.shadows.card,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] },
  disc: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.status.successText,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
