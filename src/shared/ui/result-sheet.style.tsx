import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  content: { gap: theme.spacing[4], alignItems: 'center' },
  media: { width: '100%', marginVertical: -theme.spacing[2] },
  copy: { textAlign: 'center' },
  action: { flex: 1, minWidth: 0 },
}))
