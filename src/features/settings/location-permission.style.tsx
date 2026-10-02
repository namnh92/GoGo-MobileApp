import { StyleSheet } from 'react-native-unistyles'

import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  card: { padding: spacing[5], marginTop: spacing[3], gap: spacing[4] },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent.soft,
  },
  statusText: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', gap: spacing[2] },
}))
