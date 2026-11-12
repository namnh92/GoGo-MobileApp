import { StyleSheet } from 'react-native-unistyles'
export const styles = StyleSheet.create(theme => ({
  dangerOutline: { backgroundColor: theme.surface.card, borderWidth: 1, borderColor: theme.status.danger },
  card: { gap: theme.spacing[3], marginBottom: theme.spacing[4] },
}))
