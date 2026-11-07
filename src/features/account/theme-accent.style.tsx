import { StyleSheet } from 'react-native-unistyles'

import { touchTarget } from '@/shared/ui/tokens'

/** Swatch is the 44pt touch target itself; the 2pt ring sits outside it, with a 2pt gap. */
const SWATCH = touchTarget.min
const RING_GAP = 2
const RING_WIDTH = 2
const RING = SWATCH + 2 * (RING_GAP + RING_WIDTH)

export const styles = StyleSheet.create(theme => ({
  intro: { gap: theme.spacing[2] },
  title: { flex: 1 },
  pressed: { backgroundColor: theme.surface.subtle },
  preview: { backgroundColor: theme.surface.subtle, borderColor: theme.accent.primary, borderWidth: 1, borderRadius: theme.radius.card, padding: theme.spacing[4], gap: theme.spacing[4] },
  sampleCard: { padding: theme.spacing[3], gap: theme.spacing[4] },
  sampleIcon: { backgroundColor: theme.accent.soft, width: 64, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sampleButton: { minHeight: 48, borderRadius: theme.radius.pill, padding: theme.spacing[3], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing[2] },
  samplePrimary: { backgroundColor: theme.accent.primary },
  sampleSecondary: { backgroundColor: theme.accent.soft },
  sampleNeutral: { backgroundColor: theme.surface.subtle },
  sampleTabs: { flexDirection: 'row', justifyContent: 'space-around', borderRadius: theme.radius.pill, backgroundColor: theme.surface.card, padding: theme.spacing[3] },
  sampleTab: { flex: 1, alignItems: 'center', gap: theme.spacing[1] },
  card: { padding: theme.spacing[5], gap: theme.spacing[3] },
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
  option: { alignItems: 'center', gap: theme.spacing[1], flex: 1, minWidth: RING },
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
