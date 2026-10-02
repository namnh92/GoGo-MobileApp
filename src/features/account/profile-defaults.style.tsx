import { StyleSheet } from 'react-native-unistyles'

import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  card: { padding: spacing[5], marginTop: spacing[4], gap: spacing[4] },
  field: { gap: spacing[2] },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  value: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  notice: { textAlign: 'center' },
})
