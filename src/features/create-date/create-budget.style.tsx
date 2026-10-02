import { StyleSheet } from 'react-native-unistyles'
import { radius, spacing, glassFx } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  body: { marginTop: spacing[2], marginBottom: spacing[6] },
  option: {
    borderRadius: radius.card,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionSub: { marginTop: 2 },
  checkBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: glassFx.badge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** ADR-0022 — a profile default offered as a chip, never applied on its own. */
  prefillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing[4] },
})
