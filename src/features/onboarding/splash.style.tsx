import { StyleSheet } from 'react-native-unistyles'

export const styles = StyleSheet.create(theme => ({
  root: {
    flex: 1,
    backgroundColor: theme.redesign.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  composition: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
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
  brand: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: theme.spacing[7],
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[3],
  },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.accent.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    letterSpacing: -0.95,
  },
  tagline: {
    marginTop: theme.spacing[2],
    textAlign: 'center',
  },
  /** Wrapper that a reveal cover sits over; the content inside keeps its final layout. */
  revealBox: {
    alignSelf: 'center',
    overflow: 'hidden',
  },
  /** Canvas-coloured, so the covered text reads as not yet drawn. Its width is animated. */
  revealCover: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.redesign.canvas,
  },
}))
