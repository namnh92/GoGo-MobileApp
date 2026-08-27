import { StyleSheet } from 'react-native'

import { colors, spacing } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[5],
  },
  title: { fontSize: 16, fontWeight: '700', color: neutral[900], textAlign: 'center' },
  body: { fontSize: 14, color: neutral[500], textAlign: 'center', lineHeight: 20 },
})
