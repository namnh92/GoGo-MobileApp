import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  image: { backgroundColor: theme.surface.subtle, overflow: 'hidden' },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface.subtle,
  },
}))
