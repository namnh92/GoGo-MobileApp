import { StyleSheet } from 'react-native'

import { colors, radius, spacing } from '@/shared/ui/tokens'

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
  staleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    marginHorizontal: spacing[5],
    marginBottom: spacing[2],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.compact,
    backgroundColor: colors.brand.amberSoft,
  },
  staleLabel: { flex: 1, fontSize: 13, color: colors.brand.amber, lineHeight: 18 },
})
