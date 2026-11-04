import { StyleSheet } from 'react-native-unistyles'

import { spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  card: { padding: spacing[4], marginTop: spacing[3], gap: spacing[3] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    minHeight: touchTarget.min,
  },
  rowText: { flex: 1 },
})
