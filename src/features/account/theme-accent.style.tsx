import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

/** Swatch is the 44pt touch target itself; the 2pt ring sits outside it, with a 2pt gap. */
const SWATCH = touchTarget.min
const RING_GAP = 2
const RING_WIDTH = 2
const RING = SWATCH + 2 * (RING_GAP + RING_WIDTH)

export const styles = StyleSheet.create(theme => ({
  card: { padding: theme.spacing[5], marginTop: theme.spacing[4], gap: theme.spacing[3] },
  title: { ...theme.type.title2, color: theme.text.primary },
  swatches: { flexDirection: 'row', gap: theme.spacing[3] },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: RING_WIDTH,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helper: { ...theme.type.bodySmall, color: theme.text.secondary },
}))
