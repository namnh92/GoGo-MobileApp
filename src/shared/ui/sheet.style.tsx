import { StyleSheet } from 'react-native-unistyles'

import { fill, overlay } from '@/shared/ui/tokens'

/**
 * Bottom sheet (#381). Solid `surface.card` — a sheet carries forms and text,
 * and glass is only for the tab bar and fixed bottom bars (#295). Radius
 * `radius.sheet` (28) on the top corners, `shadows.toast` to lift it off the
 * backdrop.
 */
export const styles = StyleSheet.create(theme => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...fill, backgroundColor: overlay.backdrop },
  backdropButton: { ...fill },
  panel: {
    backgroundColor: theme.surface.card,
    borderTopLeftRadius: theme.radius.sheet,
    borderTopRightRadius: theme.radius.sheet,
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[3],
    // Gives way to the keyboard: the panel shrinks and its content scrolls
    // instead of being pushed off the top of the screen.
    flexShrink: 1,
    ...theme.shadows.toast,
  },
  discoveryPanel: { backgroundColor: theme.redesign.card, paddingHorizontal: 16, paddingTop: 8 },
  discoveryHandle: { height: 6, marginBottom: 8, backgroundColor: theme.redesign.highest },
  panelFull: { height: '92%' },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border.hairline,
    alignSelf: 'center',
    marginBottom: theme.spacing[4],
  },
  body: { flexShrink: 1 },
  bodyFull: { flex: 1 },
}))
