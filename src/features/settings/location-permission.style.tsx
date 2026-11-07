import { StyleSheet } from 'react-native-unistyles'

import { spacing } from '@/shared/ui/tokens'

export const styles = StyleSheet.create(theme => ({
  card: { padding: spacing[4], marginTop: 0, gap: spacing[2], borderRadius: 0, shadowOpacity: 0, elevation: 0, borderTopWidth: 1, borderTopColor: theme.redesign.low },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.redesign.container,
  },
  statusText: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', gap: spacing[2] },
}))
