import { StyleSheet } from 'react-native-unistyles'

import { spacing, touchTarget } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  card: { padding: spacing[4], marginTop: 0, gap: spacing[3], borderRadius: 0, shadowOpacity: 0, elevation: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    minHeight: touchTarget.min,
  },
  rowText: { flex: 1 },
})
