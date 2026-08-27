import { StyleSheet } from 'react-native'
import { colors, spacing, onDark } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: neutral[900],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[7],
  },
  pair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    marginBottom: spacing[8],
  },
  times: { color: onDark.soft, fontSize: 28 },
  message: { color: onDark.soft, fontSize: 16, fontWeight: '500' },
  matched: { color: neutral[0], fontSize: 36, fontWeight: '800' },
  matchedBody: { color: onDark.soft, fontSize: 16, marginTop: spacing[2], textAlign: 'center' },
  backLink: { fontSize: 14, fontWeight: '600', color: colors.brand.coral, textDecorationLine: 'underline' },
})
