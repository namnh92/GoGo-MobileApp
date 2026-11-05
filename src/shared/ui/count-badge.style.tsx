import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: theme.surface.canvas,
  },
  count: { backgroundColor: theme.accent.primary },
  live: { backgroundColor: theme.status.successSoft },
  liveDot: { width: 5, height: 5, borderRadius: theme.radius.pill, backgroundColor: theme.status.successText },
}))
