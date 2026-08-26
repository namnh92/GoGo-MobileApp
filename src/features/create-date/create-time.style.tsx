import { StyleSheet } from 'react-native'
import { colors, radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  stepLabel: { fontSize: 13, color: colors.neutral[500], fontWeight: '500' },
  title: { fontSize: 28, fontWeight: '800', color: colors.neutral[900], lineHeight: 34 },
  body: { fontSize: 15, color: colors.neutral[500], marginTop: spacing[2], marginBottom: spacing[6] },
  option: {
    height: 56,
    borderRadius: radius.compact,
    justifyContent: 'center',
    paddingHorizontal: spacing[5],
  },
  optionLabel: { fontSize: 16, fontWeight: '600' },
  exactLabel: { fontSize: 13, color: colors.neutral[500], fontWeight: '500', marginBottom: spacing[3] },
  timeBox: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    borderRadius: 12,
    padding: spacing[3],
    alignItems: 'center',
  },
  timeCaption: { fontSize: 11, color: colors.neutral[500], fontWeight: '500' },
  timeValue: { fontSize: 20, fontWeight: '800', color: colors.neutral[900], marginTop: 2 },
})
