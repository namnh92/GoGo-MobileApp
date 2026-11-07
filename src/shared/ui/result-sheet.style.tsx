import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  content: { gap: theme.spacing[4], alignItems: 'center' },
  copy: { textAlign: 'center' },
  action: { flex: 1, minWidth: 0, height: undefined, minHeight: 56, paddingVertical: 12 },
  actions: { flexDirection: 'row', gap: theme.spacing[2], paddingTop: theme.spacing[5] },
}))
