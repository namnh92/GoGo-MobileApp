import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  image: { backgroundColor: theme.surface.subtle, overflow: 'hidden' },
  /** The neutral tile remains beneath the image throughout its fade. */
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
