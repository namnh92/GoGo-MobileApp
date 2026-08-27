import { StyleSheet } from 'react-native'
import { colors, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.neutral[900], lineHeight: 32, marginTop: spacing[2] },
  body: { fontSize: 15, color: colors.neutral[500], marginTop: spacing[2], marginBottom: spacing[6] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  option: {
    width: '48%',
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  optionLabel: { fontSize: 13, fontWeight: '600' },
  error: { fontSize: 13, color: colors.brand.red, marginTop: spacing[4] },
})
