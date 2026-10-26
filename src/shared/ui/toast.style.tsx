import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '90%',
    backgroundColor: theme.text.primary,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: 10,
    borderRadius: theme.radius.compact,
    zIndex: 20,
    ...theme.shadows.toast,
  },
  host: { flex: 1 },
}))
