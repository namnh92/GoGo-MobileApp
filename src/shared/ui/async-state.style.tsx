import { StyleSheet } from 'react-native'

import { colors, radius, spacing, type } from '@/shared/ui/tokens'

const { neutral } = colors

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[5],
  },
  title: { ...type.body, fontWeight: '700', color: neutral[900], textAlign: 'center' },
  body: { ...type.bodySmall, color: neutral[500], textAlign: 'center' },
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
  staleLabel: { ...type.bodySmall, flex: 1, color: colors.brand.amber },
})
