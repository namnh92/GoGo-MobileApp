import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  row: { flexDirection: 'row', gap: theme.spacing[3], alignItems: 'flex-start' },
  avatar: { paddingTop: 2 },
  body: { flex: 1, minWidth: 0, gap: theme.spacing[3] },
}))
