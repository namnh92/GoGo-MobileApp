import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  /** Every bar: a one-point hairline on top, children above the material. */
  bar: {
    borderTopWidth: 1,
    borderTopColor: theme.border.hairline,
    overflow: 'hidden',
  },
  /** An action bar (`floating` or `docked`): screen gutter, 16pt on top. */
  padded: {
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[4],
  },
  /** Pinned to the bottom edge; content scrolls under it. */
  floating: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  /** `surface.card` at 78 % — the layer that carries contrast on every path. */
  wash: { backgroundColor: theme.glass.bar.wash },
}))
