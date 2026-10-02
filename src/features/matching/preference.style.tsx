import { StyleSheet } from 'react-native-unistyles'
import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  title: { marginTop: spacing[2] },
  body: { marginTop: spacing[2], marginBottom: spacing[6] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  option: {
    width: '48%',
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  error: { marginTop: spacing[4] },
  /** ADR-0022 — a profile default offered as a chip, never applied on its own. */
  prefillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing[4] },
})
