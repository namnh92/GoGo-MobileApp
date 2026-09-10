import { StyleSheet } from 'react-native'
import { colors, radius, spacing, glassFx, type } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  title: { ...type.display, color: colors.neutral[900] },
  body: { ...type.body, color: colors.neutral[500], marginTop: spacing[2], marginBottom: spacing[6] },
  option: {
    borderRadius: radius.card,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionTitle: { ...type.title2 },
  optionSub: { ...type.bodySmall, marginTop: 2 },
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
