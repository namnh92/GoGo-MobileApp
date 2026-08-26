import { StyleSheet } from 'react-native'
import { colors, radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  stepLabel: { fontSize: 13, color: colors.neutral[500], fontWeight: '500' },
  title: { fontSize: 28, fontWeight: '800', color: colors.neutral[900], lineHeight: 34 },
  body: { fontSize: 15, color: colors.neutral[500], marginTop: spacing[2], marginBottom: spacing[6] },
  option: {
    borderRadius: radius.card,
    padding: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionTitle: { fontSize: 16, fontWeight: '700' },
  optionSub: { fontSize: 13, marginTop: 2 },
  checkBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
