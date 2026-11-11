import { StyleSheet } from 'react-native-unistyles'

import { shadows } from '@/shared/ui/tokens'

const SWATCH = 48
const RING = 56

export const styles = StyleSheet.create(theme => ({
  intro: { gap: theme.spacing[2] },
  section: { gap: theme.spacing[3] },
  live: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing[1] },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent.primary },
  title: { flex: 1 },
  helper: { textAlign: 'center' },
  pressed: { backgroundColor: theme.surface.subtle },
  preview: { backgroundColor: theme.surface.low, borderRadius: 12, ...shadows.subtle, padding: theme.spacing[4], gap: theme.spacing[4] },
  sampleCard: { padding: theme.spacing[3], gap: theme.spacing[4], borderRadius: 12, ...shadows.subtle },
  sampleIcon: { backgroundColor: theme.accent.soft, width: 80, height: 80, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sampleBookmark: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.accent.soft, alignItems: 'center', justifyContent: 'center' },
  activeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.accent.primary },
  sampleButton: { minHeight: 48, borderRadius: theme.radius.pill, padding: theme.spacing[3], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing[2] },
  samplePrimary: { backgroundColor: theme.accent.primary },
  sampleSecondary: { backgroundColor: theme.accent.soft },
  sampleNeutral: { backgroundColor: theme.surface.container },
  sampleTabs: { flexDirection: 'row', justifyContent: 'space-around', borderRadius: theme.radius.pill, backgroundColor: theme.surface.card, padding: theme.spacing[3] },
  sampleTab: { flex: 1, alignItems: 'center', gap: theme.spacing[1] },
  card: { padding: theme.spacing[3], gap: theme.spacing[3], borderRadius: 12, ...shadows.subtle },
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
  option: { alignItems: 'center', gap: theme.spacing[1], flex: 1, minWidth: RING, paddingVertical: theme.spacing[2] },
  optionLabel: { textAlign: 'center' },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    backgroundColor: 'transparent',
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
