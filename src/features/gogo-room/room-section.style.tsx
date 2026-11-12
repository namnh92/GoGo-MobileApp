import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  card: { padding: theme.spacing[4], gap: theme.spacing[3] },
  heading: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2] },
  headingWithAction: { paddingRight: theme.spacing[5] + theme.spacing[2] },
  compactAction: { position: 'absolute', top: theme.spacing[4], right: theme.spacing[4] },
  title: { flex: 1 },
}))
