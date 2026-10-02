import { StyleSheet } from 'react-native-unistyles'

import { colors, radius, spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[5],
  },
  title: { textAlign: 'center' },
  body: { textAlign: 'center' },
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
  staleLabel: { flex: 1 },
})
