import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

/** Swatch is the 44pt touch target itself; the 2pt ring sits outside it, with a 2pt gap. */
const SWATCH = touchTarget.min
const RING_GAP = 2
const RING_WIDTH = 2
const RING = SWATCH + 2 * (RING_GAP + RING_WIDTH)

export const styles = StyleSheet.create(theme => ({
  card: { padding: theme.spacing[5], marginTop: theme.spacing[4], gap: theme.spacing[3] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3] },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.soft,
  },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  option: { alignItems: 'center', gap: theme.spacing[1], minWidth: RING },
  optionLabel: { textAlign: 'center' },
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
}))
