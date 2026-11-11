import { StyleSheet } from 'react-native-unistyles'
import { radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  options: { gap: spacing[3] },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing[4] },
  body: { marginTop: spacing[2], marginBottom: spacing[6] },
  option: {
    borderRadius: radius.card,
    padding: spacing[4],
    minHeight: 88,
    gap: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionActive: { backgroundColor: theme.accent.soft, borderWidth: 1, borderColor: theme.accent.soft },
  optionBody: { flex: 1 },
  optionSub: { marginTop: 2 },
  checkBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.surface.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBubbleActive: { backgroundColor: theme.accent.primary },
  /** ADR-0022 — a profile default offered as a chip, never applied on its own. */
  prefillRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2], marginBottom: spacing[4] },
  prefillAmount: { maxWidth: '100%', flexShrink: 1 },
}))
