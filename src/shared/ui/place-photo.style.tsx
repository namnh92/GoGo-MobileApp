import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  image: { backgroundColor: theme.surface.subtle, overflow: 'hidden' },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface.subtle,
  },
  /** The placeholder tile, drawn under an image that has not arrived yet. */
  underlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))
