import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  card: {
    backgroundColor: theme.surface.card,
    borderRadius: theme.radius.card,
    ...theme.shadows.card,
  },
  padded: { padding: theme.spacing[4] },
}))
