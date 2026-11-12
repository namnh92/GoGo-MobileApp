import { StyleSheet } from 'react-native-unistyles'
import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing[4] },
  body: { marginTop: spacing[2], marginBottom: spacing[6] },
  /** ADR-0022 — a profile default offered as a chip, never applied on its own. */
  prefillRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2], marginBottom: spacing[4] },
  prefillAmount: { maxWidth: '100%', flexShrink: 1 },
})
