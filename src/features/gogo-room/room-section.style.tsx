import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  card: { padding: theme.spacing[4], gap: theme.spacing[3] },
  heading: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  title: { flex: 1 },
}))
