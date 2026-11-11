import { StyleSheet } from 'react-native-unistyles'
import { chipRowGap, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing[4], paddingBottom: spacing[6] },
  body: { marginTop: spacing[2], marginBottom: spacing[6] },
  distanceHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[4], marginBottom: spacing[3] },
  distanceTitle: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: chipRowGap },
  locationFallback: {
    marginTop: spacing[2],
  },
  /** ADR-0022 — a profile default offered as a chip, never applied on its own. */
  prefillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing[3] },
})
