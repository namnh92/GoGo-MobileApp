import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  root: {
    flex: 1,
    backgroundColor: theme.surface.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  map: {
    overflow: 'visible',
  },
  /** A pin layer sits over the outline, same box, so both share one coordinate system. */
  pin: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  /** The ring that spreads from a pin's tip as it lands. Size and position are per pin. */
  ripple: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: theme.accent.primary,
    opacity: 0,
  },
  textBlock: {
    alignItems: 'center',
    marginTop: theme.spacing[7],
  },
  wordmark: {
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: theme.spacing[2],
    textAlign: 'center',
  },
}))
