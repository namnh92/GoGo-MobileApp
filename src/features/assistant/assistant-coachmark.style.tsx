import { StyleSheet } from 'react-native-unistyles'

import { fill, overlay, touchTarget } from '@/shared/ui/tokens'

/**
 * Design system `Coachmark`: a dark tooltip (neutral 900 — the theme carries it
 * as `text.primary`) over a dimmed screen, the arrow at its bottom-right
 * pointing down at the float button. Pressed is a colour change only (#382).
 */
export const styles = StyleSheet.create(theme => ({
  dim: { ...fill, backgroundColor: overlay.backdrop },
  card: {
    position: 'absolute',
    width: 280,
    backgroundColor: theme.text.primary,
    borderRadius: theme.radius.card,
    padding: theme.spacing[4],
    gap: 6,
    ...theme.shadows.toast,
  },
  arrow: {
    position: 'absolute',
    bottom: -6,
    right: 22,
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: theme.text.primary,
    transform: [{ rotate: '45deg' }],
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing[2], marginTop: theme.spacing[2] },
  action: {
    minHeight: touchTarget.min,
    minWidth: touchTarget.min,
    paddingHorizontal: theme.spacing[4],
    borderRadius: theme.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostPressed: { backgroundColor: theme.night.raised },
  primary: { backgroundColor: theme.accent.primary },
  primaryPressed: { backgroundColor: theme.accent.pressed },
}))
