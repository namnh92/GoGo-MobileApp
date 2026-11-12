import { StyleSheet } from 'react-native-unistyles'
import { radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  disabled: { opacity: 0.5 },
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
}))
