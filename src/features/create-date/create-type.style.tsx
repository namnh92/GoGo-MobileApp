import { StyleSheet } from 'react-native'
import { colors, radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.neutral[900],
    lineHeight: 34,
    marginTop: spacing[2],
  },
  option: {
    borderRadius: radius.hero,
    padding: spacing[5],
    flexDirection: 'row',
    gap: spacing[4],
    alignItems: 'flex-start',
  },
  optionEmoji: { fontSize: 30 },
  optionTitle: { fontSize: 18, fontWeight: '800' },
  optionDesc: { fontSize: 13, marginTop: 4, lineHeight: 19 },
})
