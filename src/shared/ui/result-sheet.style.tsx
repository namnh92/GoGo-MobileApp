import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  content: { gap: theme.spacing[4], alignItems: 'center' },
  copy: { textAlign: 'center' },
  actions: { gap: theme.spacing[2], paddingTop: theme.spacing[5] },
}))
