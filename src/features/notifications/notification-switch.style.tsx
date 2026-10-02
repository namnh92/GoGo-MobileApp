import { StyleSheet } from 'react-native-unistyles'

import { spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  syncState: {
    minHeight: touchTarget.min,
    marginTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  subTitle: {
    textTransform: 'uppercase',
    marginTop: spacing[4],
    marginBottom: spacing[2],
  },
  card: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], marginTop: spacing[3], gap: spacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    minHeight: touchTarget.min,
  },
  rowText: { flex: 1, gap: 2 },
  deviceCard: { padding: spacing[4], gap: spacing[3] },
  caption: { marginTop: spacing[3] },
  error: { marginTop: spacing[3] },
})
