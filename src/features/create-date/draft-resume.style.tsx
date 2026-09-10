import { StyleSheet } from 'react-native'

import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] },
  action: { flex: 1 },
})
