import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[3],
  },
  title: { textAlign: 'center' },
  body: { textAlign: 'center', marginBottom: theme.spacing[4] },
}))
